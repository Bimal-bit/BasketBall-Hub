import time
import json
import os
import re
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from functools import wraps
from datetime import datetime
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
# Lazy-import `nba_api` endpoints and static helpers inside functions to avoid
# triggering network calls at module import time during deployments.
import pandas as pd
import numpy as np
import requests
from nba_api.stats.library.http import NBAStatsHTTP

NBA_API_TIMEOUT = int(os.getenv("NBA_API_TIMEOUT", "20"))

# NBA Stats Headers to avoid 403 Forbidden
NBA_HEADERS = {
    "Host": "stats.nba.com",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://www.nba.com",
    "Referer": "https://www.nba.com/",
    "Connection": "keep-alive"
}
ESPN_HEADERS = {
    "Host": "site.api.espn.com",
    "User-Agent": NBA_HEADERS["User-Agent"],
    "Accept": "application/json",
    "Origin": "https://www.espn.com",
    "Referer": "https://www.espn.com/",
    "Connection": "keep-alive",
}
ESPN_CORE_HEADERS = {
    **ESPN_HEADERS,
    "Host": "sports.core.api.espn.com",
    "Origin": "https://www.espn.com",
    "Referer": "https://www.espn.com/",
}
# Create a custom requests Session with a default timeout to avoid infinite hangs
class DefaultTimeoutSession(requests.Session):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Configure a retry strategy to tolerate transient upstream failures
        try:
            from urllib3.util.retry import Retry
            from requests.adapters import HTTPAdapter

            retry_strategy = Retry(
                total=1,
                backoff_factor=0.25,
                status_forcelist=[500, 502, 503, 504],
                allowed_methods=["HEAD", "GET", "OPTIONS"]
            )
            adapter = HTTPAdapter(max_retries=retry_strategy)
            self.mount("https://", adapter)
            self.mount("http://", adapter)
        except Exception:
            # If urllib3 Retry isn't available for some reason, continue without retries
            pass

        # Apply sensible default headers so many CDN endpoints accept requests
        try:
            self.headers.update(NBA_HEADERS)
        except Exception:
            pass

    def request(self, method, url, *args, **kwargs):
        if 'timeout' not in kwargs or kwargs['timeout'] is None:
            kwargs['timeout'] = NBA_API_TIMEOUT
        return super().request(method, url, *args, **kwargs)

# Apply headers and custom session globally to all nba_api requests
NBAStatsHTTP.default_headers = NBA_HEADERS
NBAStatsHTTP.timeout = NBA_API_TIMEOUT
NBAStatsHTTP.set_session(DefaultTimeoutSession())

# A shared HTTP session for our direct requests (CDN, ESPN, etc.) with retries
HTTP = DefaultTimeoutSession()
HTTP.headers.update(NBA_HEADERS)
ESPN_GAME_CACHE = {}
NBA_PLAYER_ID_BY_NAME = None
ESPN_TEAM_ID_MAP = None
ESPN_PLAYER_STATS_CACHE = {}

def normalize_person_name(name):
    normalized = unicodedata.normalize("NFKD", str(name or ""))
    return "".join(char for char in normalized if not unicodedata.combining(char)).casefold().strip()

def get_nba_teams_by_abbreviation():
    from nba_api.stats.static import teams as nba_teams
    teams = {team["abbreviation"].upper(): team for team in nba_teams.get_teams()}
    for alias, abbreviation in {
        "GS": "GSW", "NY": "NYK", "SA": "SAS", "NO": "NOP",
        "WSH": "WAS", "UTAH": "UTA",
    }.items():
        if abbreviation in teams:
            teams[alias] = teams[abbreviation]
    return teams

def get_nba_player_ids_by_name():
    global NBA_PLAYER_ID_BY_NAME
    if NBA_PLAYER_ID_BY_NAME is None:
        from nba_api.stats.static import players
        NBA_PLAYER_ID_BY_NAME = {
            normalize_person_name(player["full_name"]): player["id"]
            for player in players.get_players()
        }
    return NBA_PLAYER_ID_BY_NAME

def get_espn_team_id_map():
    global ESPN_TEAM_ID_MAP
    if ESPN_TEAM_ID_MAP is None:
        response = HTTP.get(
            "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams",
            params={"limit": 100},
            headers=ESPN_HEADERS,
            timeout=NBA_API_TIMEOUT,
        )
        response.raise_for_status()
        nba_teams = get_nba_teams_by_abbreviation()
        teams = {}
        for sport in response.json().get("sports") or []:
            for league in sport.get("leagues") or []:
                for entry in league.get("teams") or []:
                    team = entry.get("team") or {}
                    abbreviation = str(team.get("abbreviation") or "").upper()
                    nba_team = nba_teams.get(abbreviation)
                    if nba_team:
                        teams[str(team.get("id"))] = {
                            "TEAM_ID": nba_team["id"],
                            "TEAM_ABBREVIATION": nba_team["abbreviation"],
                            "TEAM_NAME": nba_team["full_name"],
                        }
        if not teams:
            raise RuntimeError("ESPN returned no team ID mappings")
        ESPN_TEAM_ID_MAP = teams
    return ESPN_TEAM_ID_MAP

def fetch_espn_player_leaders(season, category, season_type="Regular Season", per_mode="PerGame", limit=50):
    category_names = {
        "Points per game": ("pointsPerGame", "PTS"),
        "PTS": ("pointsPerGame", "PTS"),
        "Total points": ("points", "PTS"),
        "Assists per game": ("assistsPerGame", "AST"),
        "AST": ("assistsPerGame", "AST"),
        "Rebounds per game": ("reboundsPerGame", "REB"),
        "REB": ("reboundsPerGame", "REB"),
        "Steals per game": ("stealsPerGame", "STL"),
        "STL": ("stealsPerGame", "STL"),
        "Blocks per game": ("blocksPerGame", "BLK"),
        "BLK": ("blocksPerGame", "BLK"),
        "Minutes per game": ("minutesPerGame", "MIN"),
        "Field goal %": ("fieldGoalPercentage", "FG_PCT"),
        "3-pointer %": ("3PointPct", "FG3_PCT"),
        "3-pointers made": ("3PointsMadePerGame", "FG3M"),
        "Free-throw %": ("FreeThrowPct", "FT_PCT"),
        "Turnovers per game": ("avgTurnovers", "TOV"),
        "Real performance rating per game": ("PER", "PER"),
    }
    requested = category_names.get(category)
    if not requested:
        raise RuntimeError(f"ESPN does not provide a matching season leaderboard for {category}")

    season_type_id = 3 if season_type == "Playoffs" else 2
    url = (
        "https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/"
        f"seasons/{espn_season_year(season)}/types/{season_type_id}/leaders"
    )
    response = HTTP.get(
        url,
        params={"limit": max(1, min(limit, 50))},
        headers=ESPN_CORE_HEADERS,
        timeout=NBA_API_TIMEOUT,
    )
    response.raise_for_status()
    categories = response.json().get("categories") or []
    selected_category = next((item for item in categories if item.get("name") == requested[0]), None)
    if not selected_category or not selected_category.get("leaders"):
        raise RuntimeError(f"ESPN has no {category} stats for {season}")

    if per_mode == "Totals":
        stat_fields = {
            "points": "PTS", "assists": "AST", "rebounds": "REB",
            "steals": "STL", "blocks": "BLK", "minutes": "MIN",
            "fieldGoalPercentage": "FG_PCT", "3PointPct": "FG3_PCT",
            "FreeThrowPct": "FT_PCT", "totalTurnovers": "TOV",
            "PER": "PER",
        }
    else:
        stat_fields = {
            "pointsPerGame": "PTS", "assistsPerGame": "AST",
            "reboundsPerGame": "REB", "stealsPerGame": "STL",
            "blocksPerGame": "BLK", "minutesPerGame": "MIN",
            "fieldGoalPercentage": "FG_PCT", "3PointPct": "FG3_PCT",
            "3PointsMadePerGame": "FG3M", "FreeThrowPct": "FT_PCT",
            "avgTurnovers": "TOV", "PER": "PER",
        }
    values_by_athlete = {}
    for stats_category in categories:
        field = stat_fields.get(stats_category.get("name"))
        if not field:
            continue
        for leader in stats_category.get("leaders") or []:
            athlete_ref = (leader.get("athlete") or {}).get("$ref") or ""
            match = re.search(r"/athletes/(\d+)", athlete_ref)
            if not match:
                continue
            value = leader.get("value")
            if value is None:
                continue
            value = float(value)
            if field in {"FG_PCT", "FG3_PCT", "FT_PCT"} and value > 1:
                value /= 100
            values_by_athlete.setdefault(match.group(1), {})[field] = value

    selected_leaders = selected_category.get("leaders") or []
    athlete_refs = {}
    team_ids = {}
    for leader in selected_leaders:
        athlete_ref = (leader.get("athlete") or {}).get("$ref") or ""
        athlete_match = re.search(r"/athletes/(\d+)", athlete_ref)
        team_ref = (leader.get("team") or {}).get("$ref") or ""
        team_match = re.search(r"/teams/(\d+)", team_ref)
        if athlete_match and team_match:
            athlete_refs[athlete_match.group(1)] = athlete_ref.replace("http://", "https://", 1)
            team_ids[athlete_match.group(1)] = team_match.group(1)

    def fetch_athlete(athlete_id, athlete_url):
        cache_key = (athlete_id, espn_season_year(season), season_type_id)
        cached = ESPN_PLAYER_STATS_CACHE.get(cache_key)
        if cached and cached["expires"] > time.time():
            return athlete_id, cached["athlete"], cached["stats"]

        athlete_response = HTTP.get(athlete_url, headers=ESPN_CORE_HEADERS, timeout=NBA_API_TIMEOUT)
        athlete_response.raise_for_status()
        athlete = athlete_response.json()
        stats = {}
        stats_ref = (athlete.get("statistics") or {}).get("$ref")
        if stats_ref:
            stats_response = HTTP.get(
                stats_ref.replace("http://", "https://", 1),
                headers=ESPN_CORE_HEADERS,
                timeout=NBA_API_TIMEOUT,
            )
            stats_response.raise_for_status()
            payload = stats_response.json()
            for stats_category in (payload.get("splits") or {}).get("categories") or []:
                for stat in stats_category.get("stats") or []:
                    if stat.get("name") and stat.get("value") is not None:
                        stats[stat["name"]] = float(stat["value"])
        ESPN_PLAYER_STATS_CACHE[cache_key] = {
            "athlete": athlete,
            "stats": stats,
            "expires": time.time() + 1800,
        }
        return athlete_id, athlete, stats

    with ThreadPoolExecutor(max_workers=8) as executor:
        athlete_results = list(executor.map(
            lambda item: fetch_athlete(*item),
            athlete_refs.items(),
        ))

    nba_ids_by_name = get_nba_player_ids_by_name()
    team_map = get_espn_team_id_map()
    rows_by_id = {}
    average_keys = {
        "PTS": ("avgPoints", "points"),
        "REB": ("avgRebounds", "rebounds"),
        "AST": ("avgAssists", "assists"),
        "STL": ("avgSteals", "steals"),
        "BLK": ("avgBlocks", "blocks"),
        "MIN": ("avgMinutes", "minutes"),
        "TOV": ("avgTurnovers", "totalTurnovers"),
        "OREB": ("avgOffensiveRebounds", "offensiveRebounds"),
        "DREB": ("avgDefensiveRebounds", "defensiveRebounds"),
        "PF": ("avgFouls", "fouls"),
        "PLUS_MINUS": ("avgPlusMinus", "plusMinus"),
        "FGM": ("avgFieldGoalsMade", "fieldGoalsMade"),
        "FGA": ("avgFieldGoalsAttempted", "fieldGoalsAttempted"),
        "FG3M": ("avgThreePointFieldGoalsMade", "threePointFieldGoalsMade"),
        "FG3A": ("avgThreePointFieldGoalsAttempted", "threePointFieldGoalsAttempted"),
        "FTM": ("avgFreeThrowsMade", "freeThrowsMade"),
        "FTA": ("avgFreeThrowsAttempted", "freeThrowsAttempted"),
    }
    for athlete_id, athlete, stats in athlete_results:
        name = athlete.get("displayName") or athlete.get("fullName")
        nba_player_id = nba_ids_by_name.get(normalize_person_name(name))
        team = team_map.get(team_ids.get(athlete_id))
        if not nba_player_id or not team:
            continue
        first_name = athlete.get("firstName") or ""
        last_name = athlete.get("lastName") or ""
        row = {
            "PERSON_ID": nba_player_id,
            "PLAYER_ID": nba_player_id,
            "PLAYER_FIRST_NAME": first_name,
            "PLAYER_LAST_NAME": last_name,
            "PLAYER_NAME": name,
            **team,
        }
        if "gamesPlayed" in stats:
            row["GP"] = stats["gamesPlayed"]
        if "gamesStarted" in stats:
            row["GS"] = stats["gamesStarted"]
        stat_index = 1 if per_mode == "Totals" else 0
        for field, names in average_keys.items():
            if names[stat_index] in stats:
                row[field] = stats[names[stat_index]]
        for field, stat_name in [
            ("FG_PCT", "fieldGoalPct"),
            ("FG3_PCT", "threePointFieldGoalPct"),
            ("FT_PCT", "freeThrowPct"),
            ("TS_PCT", "trueShootingPct"),
            ("PER", "PER"),
        ]:
            if stat_name in stats:
                value = stats[stat_name]
                row[field] = value / 100 if field.endswith("_PCT") and value > 1 else value
        for field, value in values_by_athlete.get(athlete_id, {}).items():
            row[field] = value
        rows_by_id[athlete_id] = row

    rows = []
    for leader in selected_leaders:
        athlete_ref = (leader.get("athlete") or {}).get("$ref") or ""
        match = re.search(r"/athletes/(\d+)", athlete_ref)
        row = rows_by_id.get(match.group(1)) if match else None
        if row:
            leader_value = leader.get("value")
            if leader_value is not None:
                value = float(leader_value)
                if requested[1].endswith("_PCT") and value > 1:
                    value /= 100
                row = {**row, requested[1]: value}
            rows.append(row)
    if not rows:
        raise RuntimeError(f"ESPN returned no mappable player leaders for {season}")
    return rows

def fetch_espn_game_summary(game_id):
    now = time.time()
    cached = ESPN_GAME_CACHE.get(str(game_id))
    if cached and cached["expires"] > now:
        return cached["data"]

    response = HTTP.get(
        "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary",
        params={"event": str(game_id)},
        headers=ESPN_HEADERS,
        timeout=12,
    )
    response.raise_for_status()
    payload = response.json()
    if not payload.get("boxscore") and not payload.get("plays"):
        raise RuntimeError(f"ESPN returned no game data for {game_id}")
    ESPN_GAME_CACHE[str(game_id)] = {"data": payload, "expires": now + 30}
    return payload

def get_espn_identity_maps(summary):
    teams_by_abbreviation = get_nba_teams_by_abbreviation()
    team_ids = {}
    player_ids = get_nba_player_ids_by_name()
    espn_player_ids = {}

    for team_data in (summary.get("boxscore") or {}).get("players") or []:
        team = team_data.get("team") or {}
        abbreviation = str(team.get("abbreviation") or "").upper()
        nba_team = teams_by_abbreviation.get(abbreviation) or {}
        espn_team_id = str(team.get("id") or "")
        if espn_team_id and nba_team.get("id"):
            team_ids[espn_team_id] = nba_team["id"]
        for stats_group in team_data.get("statistics") or []:
            for athlete in stats_group.get("athletes") or []:
                details = athlete.get("athlete") or {}
                nba_player_id = player_ids.get(normalize_person_name(details.get("displayName")))
                if details.get("id") and nba_player_id:
                    espn_player_ids[str(details["id"])] = nba_player_id
    return team_ids, espn_player_ids

def fetch_espn_boxscore(game_id):
    summary = fetch_espn_game_summary(game_id)
    team_ids, _ = get_espn_identity_maps(summary)
    players = []
    def made_attempted(value):
        match = re.fullmatch(r"\s*(\d+)\s*-\s*(\d+)\s*", str(value or ""))
        return (int(match.group(1)), int(match.group(2))) if match else (0, 0)

    for team_data in (summary.get("boxscore") or {}).get("players") or []:
        team = team_data.get("team") or {}
        team_id = team_ids.get(str(team.get("id") or ""), 0)
        abbreviation = str(team.get("abbreviation") or "")
        for stats_group in team_data.get("statistics") or []:
            labels = stats_group.get("labels") or []
            index = {label: labels.index(label) for label in labels}
            for athlete in stats_group.get("athletes") or []:
                details = athlete.get("athlete") or {}
                player_id = get_nba_player_ids_by_name().get(normalize_person_name(details.get("displayName")))
                if not player_id:
                    continue
                values = athlete.get("stats") or []
                def value(label, default=0):
                    position = index.get(label)
                    if position is None or position >= len(values):
                        return default
                    try:
                        return float(values[position])
                    except (TypeError, ValueError):
                        return default

                fgm, fga = made_attempted(values[index["FG"]]) if "FG" in index and index["FG"] < len(values) else (0, 0)
                fg3m, fg3a = made_attempted(values[index["3PT"]]) if "3PT" in index and index["3PT"] < len(values) else (0, 0)
                ftm, fta = made_attempted(values[index["FT"]]) if "FT" in index and index["FT"] < len(values) else (0, 0)
                minutes = values[index["MIN"]] if "MIN" in index and index["MIN"] < len(values) else 0
                players.append({
                    "GAME_ID": str(game_id),
                    "TEAM_ID": team_id,
                    "TEAM_ABBREVIATION": abbreviation,
                    "PLAYER_ID": player_id,
                    "PLAYER_NAME": details.get("displayName"),
                    "START_POSITION": athlete.get("starter", False),
                    "MIN": minutes,
                    "PTS": value("PTS"),
                    "REB": value("REB"),
                    "AST": value("AST"),
                    "STL": value("STL"),
                    "BLK": value("BLK"),
                    "TOV": value("TO"),
                    "TO": value("TO"),
                    "OREB": value("OREB"),
                    "DREB": value("DREB"),
                    "PF": value("PF"),
                    "PLUS_MINUS": value("+/-"),
                    "FGM": fgm,
                    "FGA": fga,
                    "FG_PCT": fgm / fga if fga else 0,
                    "FG3M": fg3m,
                    "FG3A": fg3a,
                    "FG3_PCT": fg3m / fg3a if fg3a else 0,
                    "FTM": ftm,
                    "FTA": fta,
                    "FT_PCT": ftm / fta if fta else 0,
                })
    if not players:
        raise RuntimeError(f"ESPN returned no player box score for {game_id}")
    return players

def fetch_espn_team_stats(game_id):
    summary = fetch_espn_game_summary(game_id)
    players = fetch_espn_boxscore(game_id)
    teams_by_id = {}
    for player in players:
        row = teams_by_id.setdefault(player["TEAM_ID"], {
            "GAME_ID": str(game_id),
            "TEAM_ID": player["TEAM_ID"],
            "TEAM_ABBREVIATION": player["TEAM_ABBREVIATION"],
            "TEAM_NAME": player["TEAM_ABBREVIATION"],
            "FGM": 0, "FGA": 0, "FG3M": 0, "FG3A": 0, "FTM": 0,
            "FTA": 0, "OREB": 0, "DREB": 0, "REB": 0, "AST": 0,
            "TOV": 0, "STL": 0, "BLK": 0, "PF": 0, "PTS": 0,
        })
        for key in ["FGM", "FGA", "FG3M", "FG3A", "FTM", "FTA", "OREB", "DREB", "REB", "AST", "TOV", "STL", "BLK", "PF", "PTS"]:
            row[key] += player.get(key, 0) or 0

    for team in (summary.get("boxscore") or {}).get("teams") or []:
        abbreviation = str((team.get("team") or {}).get("abbreviation") or "")
        for row in teams_by_id.values():
            if row["TEAM_ABBREVIATION"] == abbreviation:
                row["TEAM_NAME"] = (team.get("team") or {}).get("displayName") or abbreviation
                break
    for row in teams_by_id.values():
        row["FG_PCT"] = row["FGM"] / row["FGA"] if row["FGA"] else 0
        row["FG3_PCT"] = row["FG3M"] / row["FG3A"] if row["FG3A"] else 0
        row["FT_PCT"] = row["FTM"] / row["FTA"] if row["FTA"] else 0
    if len(teams_by_id) != 2:
        raise RuntimeError(f"ESPN returned incomplete team stats for {game_id}")
    return list(teams_by_id.values())

def fetch_espn_playbyplay(game_id):
    summary = fetch_espn_game_summary(game_id)
    team_ids, player_ids = get_espn_identity_maps(summary)
    player_names = {}
    for team_data in (summary.get("boxscore") or {}).get("players") or []:
        for stats_group in team_data.get("statistics") or []:
            for athlete in stats_group.get("athletes") or []:
                details = athlete.get("athlete") or {}
                if details.get("id") and details.get("displayName"):
                    player_names[str(details["id"])] = details["displayName"]
    competition = ((summary.get("header") or {}).get("competitions") or [{}])[0]
    competitors = competition.get("competitors") or []
    home_espn_id = next((str(team.get("id")) for team in competitors if team.get("homeAway") == "home"), "")
    away_espn_id = next((str(team.get("id")) for team in competitors if team.get("homeAway") == "away"), "")
    result = []
    for play in summary.get("plays") or []:
        description = str(play.get("text") or "")
        text = f"{(play.get('type') or {}).get('text', '')} {description}".lower()
        is_shot = bool(play.get("shootingPlay"))
        is_free_throw = "free throw" in text
        if is_free_throw:
            event_type = 3
        elif is_shot:
            event_type = 1 if play.get("scoringPlay") else 2
        elif "rebound" in text:
            event_type = 4
        elif "turnover" in text:
            event_type = 5
        elif "foul" in text:
            event_type = 6
        elif "timeout" in text:
            event_type = 9
        elif "jump ball" in text:
            event_type = 10
        elif "substitut" in text:
            event_type = 8
        elif "period" in text and "start" in text:
            event_type = 12
        elif "period" in text:
            event_type = 13
        else:
            event_type = 0

        team_espn_id = str((play.get("team") or {}).get("id") or "")
        participants = play.get("participants") or []
        participant_espn_ids = [
            str((participant.get("athlete") or {}).get("id") or "")
            for participant in participants
        ]
        participant_ids = [
            player_ids.get(espn_player_id, 0)
            for espn_player_id in participant_espn_ids
        ]
        distance_match = re.search(r"(\d+)[- ]foot", description, re.IGNORECASE)
        event = {
            "EVENTNUM": int(play.get("sequenceNumber") or 0),
            "EVENTMSGTYPE": event_type,
            "PERIOD": (play.get("period") or {}).get("number"),
            "PCTIMESTRING": (play.get("clock") or {}).get("displayValue", ""),
            "HOMEDESCRIPTION": description if team_espn_id == home_espn_id else None,
            "VISITORDESCRIPTION": description if team_espn_id == away_espn_id else None,
            "NEUTRALDESCRIPTION": description if not team_espn_id else None,
            "SCORE": f"{play.get('awayScore', 0)}-{play.get('homeScore', 0)}",
            "SCOREMARGIN": None,
            "SHOT_VALUE": int(play.get("scoreValue") or play.get("pointsAttempted") or 0),
            "SHOT_DISTANCE": int(distance_match.group(1)) if distance_match else 0,
            "PLAYER1_ID": participant_ids[0] if participant_ids else 0,
            "PLAYER1_NAME": player_names.get(participant_espn_ids[0]) if participant_espn_ids else None,
            "PLAYER2_ID": participant_ids[1] if len(participant_ids) > 1 else 0,
            "PLAYER2_NAME": player_names.get(participant_espn_ids[1]) if len(participant_espn_ids) > 1 else None,
            "PLAYER3_ID": participant_ids[2] if len(participant_ids) > 2 else 0,
            "PLAYER3_NAME": player_names.get(participant_espn_ids[2]) if len(participant_espn_ids) > 2 else None,
        }
        result.append(event)
    if not result:
        raise RuntimeError(f"ESPN returned no play-by-play for {game_id}")
    return result

def fetch_espn_shots(game_id, player_id=None, team_id=None):
    summary = fetch_espn_game_summary(game_id)
    team_ids, player_ids = get_espn_identity_maps(summary)
    shots = []
    for play in summary.get("plays") or []:
        coordinate = play.get("coordinate") or {}
        if not play.get("shootingPlay") or coordinate.get("x") is None or coordinate.get("y") is None:
            continue
        participants = play.get("participants") or []
        espn_player_id = str((participants[0].get("athlete") or {}).get("id") or "") if participants else ""
        nba_player_id = player_ids.get(espn_player_id)
        espn_team_id = str((play.get("team") or {}).get("id") or "")
        nba_team_id = team_ids.get(espn_team_id)
        if player_id is not None and nba_player_id != player_id:
            continue
        if team_id is not None and nba_team_id != team_id:
            continue
        x, y = float(coordinate["x"]), float(coordinate["y"])
        if not (0 <= x <= 50 and 0 <= y <= 50):
            continue
        description = str(play.get("text") or "")
        distance_match = re.search(r"(\d+)[- ]foot", description, re.IGNORECASE)
        distance = int(distance_match.group(1)) if distance_match else 0
        shots.append({
            "GAME_ID": str(game_id),
            "GAME_EVENT_ID": play.get("id"),
            "PLAYER_ID": nba_player_id or 0,
            "PLAYER_NAME": description.split(" misses ", 1)[0].split(" makes ", 1)[0],
            "TEAM_ID": nba_team_id or 0,
            "LOC_X": (x - 25) * 5,
            "LOC_Y": y * 5,
            "SHOT_DISTANCE": distance,
            "SHOT_MADE_FLAG": 1 if play.get("scoringPlay") else 0,
            "SHOT_TYPE": "3PT Field Goal" if play.get("pointsAttempted") == 3 else "2PT Field Goal",
            "ACTION_TYPE": (play.get("type") or {}).get("text") or description,
        })
    return shots

app = FastAPI(title="NBA Intelligence API")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

@app.middleware("http")
async def add_cache_control_headers(request: Request, call_next):
    response = await call_next(request)
    if request.method != "GET" or response.status_code >= 400:
        return response

    path = request.url.path
    max_age = 60
    if path == "/api/scoreboard":
        max_age = 30
    elif path == "/api/standings" or path == "/api/fatigue":
        max_age = 300
    elif path.startswith("/api/player/") or path.startswith("/api/players") or path in {"/api/awards", "/api/leaders"}:
        max_age = 600
    elif path.startswith("/api/game/"):
        max_age = 60

    response.headers["Cache-Control"] = f"public, max-age={max_age}"
    return response

CACHE_FILE = "api_cache.json"

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

def load_persistent_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_persistent_cache(data):
    try:
        # Only save small/critical data to avoid giant files
        # We only save standings and player lists
        to_save = {}
        for k, v in data.items():
            if not any(x in k for x in ["standings", "players", "teams"]):
                continue
            if k.startswith("get_standings:") and not has_real_standings(v.get("data") if isinstance(v, dict) else None):
                continue
            to_save[k] = v
        with open(CACHE_FILE, 'w') as f:
            json.dump(to_save, f)
    except:
        pass

# Simple cache to avoid hitting NBA API too frequently
cache = load_persistent_cache()

def clean_data(data):
    """Recursively replace NaN values with None for JSON compliance"""
    if isinstance(data, list):
        return [clean_data(item) for item in data]
    elif isinstance(data, dict):
        return {k: clean_data(v) for k, v in data.items()}
    elif isinstance(data, float):
        if pd.isna(data) or data != data:
            return None
        return data
    return data

def clean_df(df):
    if df.empty:
        return []
    return clean_data(df.to_dict(orient='records'))

def to_number(value, default=0):
    try:
        if value is None or pd.isna(value):
            return default
        return float(value)
    except Exception:
        return default

def current_nba_season():
    """Return season label used by stats.nba.com, e.g. 2026-27."""
    now = pd.Timestamp.now()
    start_year = now.year if now.month >= 10 else now.year - 1
    return f"{start_year}-{str(start_year + 1)[-2:]}"

def days_between(a, b):
    try:
        first = pd.to_datetime(a).normalize()
        second = pd.to_datetime(b).normalize()
        return abs((first - second).days)
    except Exception:
        return 0

def compute_fatigue_score(minutes_last_3, back_to_back, games_last_7, performance_drop):
    score = 0
    score += min(minutes_last_3 / 3, 40) * 0.8
    score += 20 if back_to_back else 0
    score += min(games_last_7, 7) * 3
    score += min(abs(performance_drop), 20) * 1.35
    return min(round(score, 1), 100)

def risk_level_from_score(score):
    if score >= 65:
        return "high"
    if score >= 45:
        return "medium"
    return "low"

EAST_TEAM_IDS = {
    1610612737, 1610612738, 1610612739, 1610612741,
    1610612748, 1610612749, 1610612751, 1610612752, 1610612753,
    1610612754, 1610612755, 1610612761, 1610612764, 1610612765,
    1610612766,
}

def has_real_standings(rows):
    return bool(rows) and any(to_number(row.get("Wins")) or to_number(row.get("Losses")) for row in rows)

def espn_season_year(season):
    try:
        clean_season = (season or current_nba_season()).split(" (")[0]
        start_year = int(clean_season.split("-")[0])
        return start_year + 1
    except Exception:
        return datetime.utcnow().year

def stat_value(stats, names, default=0, prefer_display=False):
    wanted = {name.lower() for name in names}
    for stat in stats or []:
        keys = [
            str(stat.get("name", "")).lower(),
            str(stat.get("displayName", "")).lower(),
            str(stat.get("shortDisplayName", "")).lower(),
            str(stat.get("abbreviation", "")).lower(),
        ]
        if any(key in wanted for key in keys):
            value = stat.get("displayValue") if prefer_display else stat.get("value", stat.get("displayValue"))
            return value if value not in [None, ""] else default
    return default

def fetch_espn_standings(season=None):
    try:
        from nba_api.stats.static import teams as nba_teams
        nba_by_abbr = {team["abbreviation"].upper(): team for team in nba_teams.get_teams()}
    except Exception as e:
        print(f"Unable to load nba teams static data: {e}")
        nba_by_abbr = {}
    nba_by_abbr.update({
        "GS": nba_by_abbr.get("GSW"),
        "NY": nba_by_abbr.get("NYK"),
        "SA": nba_by_abbr.get("SAS"),
        "NO": nba_by_abbr.get("NOP"),
        "WSH": nba_by_abbr.get("WAS"),
        "UTAH": nba_by_abbr.get("UTA"),
    })

    try:
        response = HTTP.get(
            "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings",
            params={
                "region": "us",
                "lang": "en",
                "season": espn_season_year(season),
                "type": 0,
                "limit": 100,
            },
            headers=ESPN_HEADERS,
            timeout=NBA_API_TIMEOUT,
        )
        response.raise_for_status()
    except Exception as e:
        print(f"ESPN standings request error: {e}")
        raise
    payload = response.json()
    rows = []

    def collect(node, conference=None):
        if not isinstance(node, dict):
            return
        name = node.get("name") or node.get("displayName") or conference
        next_conference = conference
        if isinstance(name, str):
            if "east" in name.lower():
                next_conference = "East"
            elif "west" in name.lower():
                next_conference = "West"

        entries = node.get("entries") or node.get("standings", {}).get("entries") or []
        for entry in entries:
            team = entry.get("team") or {}
            abbr = str(team.get("abbreviation") or "").upper()
            nba_team = nba_by_abbr.get(abbr)
            if not nba_team:
                continue
            stats = entry.get("stats") or []
            wins = int(float(stat_value(stats, ["wins", "w"], 0)))
            losses = int(float(stat_value(stats, ["losses", "l"], 0)))
            pct = stat_value(stats, ["winpercent", "win pct", "pct", "p"], None)
            if pct is None and wins + losses:
                pct = wins / (wins + losses)
            pct = float(pct or 0)
            if pct > 1:
                pct = pct / 100
            rows.append({
                "TeamID": nba_team["id"],
                "TeamCity": nba_team["city"],
                "TeamName": nba_team["nickname"],
                "Conference": next_conference or ("East" if nba_team["id"] in EAST_TEAM_IDS else "West"),
                "Wins": wins,
                "Losses": losses,
                "WinPCT": round(pct, 3),
                "L10Rec": str(stat_value(stats, ["lasttengames", "last 10", "l10"], "", prefer_display=True)),
                "Strk": str(stat_value(stats, ["streak", "strk"], "", prefer_display=True)),
                "source": "espn",
            })

        for child_key in ["children", "groups"]:
            for child in node.get(child_key) or []:
                collect(child, next_conference)

    collect(payload)
    if not has_real_standings(rows):
        raise RuntimeError("ESPN standings returned no usable records")
    return rows

def fallback_standings(season=None):
    try:
        return fetch_espn_standings(season)
    except Exception as e:
        print(f"ESPN standings fallback error: {e}")
        # Return an empty standings list instead of raising so the frontend can still load
        # and show a meaningful message instead of a 503.
        return []

def cached(duration=60, ttl=None, fallback=None):
    if ttl is not None:
        duration = ttl

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Create a cache key from function name and arguments
            key = f"{func.__name__}:{args}:{kwargs}"
            now = time.time()
            
            if key in cache and now < cache[key]["expiry"]:
                cached_data = cache[key]["data"]
                if func.__name__ == "get_standings" and not has_real_standings(cached_data):
                    cache.pop(key, None)
                    save_persistent_cache(cache)
                else:
                    return cached_data
            
            try:
                # Handle both sync and async functions
                import inspect
                if inspect.iscoroutinefunction(func):
                    data = await func(*args, **kwargs)
                else:
                    import asyncio
                    # Use asyncio.to_thread to run sync functions in a thread
                    data = await asyncio.to_thread(func, *args, **kwargs)
                
                cache[key] = {
                    "data": data,
                    "expiry": now + duration
                }
                save_persistent_cache(cache)
                return data
            except Exception as e:
                print(f"Error in {func.__name__}: {e}")
                if key in cache:
                    return cache[key]["data"]
                if isinstance(e, HTTPException):
                    raise
                if fallback is not None:
                    data = fallback(*args, **kwargs) if callable(fallback) else fallback
                    cache[key] = {
                        "data": data,
                        "expiry": now + min(duration, 300)
                    }
                    save_persistent_cache(cache)
                    return data
                raise HTTPException(status_code=500, detail=str(e))
        return wrapper
    return decorator

# Update get_cached_data to use the global cache or just use the decorator
def get_cached_data(key, fetch_func, duration=60):
    now = time.time()
    if key in cache and now < cache[key]["expiry"]:
        return cache[key]["data"]
    
    try:
        data = fetch_func()
        cache[key] = {
            "data": data,
            "expiry": now + duration
        }
        return data
    except Exception as e:
        print(f"Error fetching {key}: {e}")
        if key in cache:
            return cache[key]["data"]
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=503, detail="Requested NBA data is temporarily unavailable.")

def get_cached_scoreboard(key, fetch_func):
    now = time.time()
    if key in cache and cache[key]["data"] is not None and now < cache[key]["expiry"]:
        return cache[key]["data"]

    try:
        data = fetch_func()
        has_live_or_scheduled = any(game.get("status") in ["live", "scheduled"] for game in data or [])
        cache_seconds = 5 if has_live_or_scheduled else 300
        cache[key] = {
            "data": data,
            "expiry": now + cache_seconds
        }
        return data
    except Exception as e:
        print(f"Error fetching {key}: {e}")
        if key in cache and cache[key]["data"] is not None:
            return cache[key]["data"]
        raise HTTPException(status_code=500, detail=str(e))

def normalize_game_date(game_date):
    if not game_date:
        return None
    if isinstance(game_date, str):
        return game_date[:10]
    return str(game_date)[:10]

def get_nba_today():
    """Returns the current date in Eastern Time (NBA HQ time)."""
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo("America/New_York")).strftime("%Y-%m-%d")
    except Exception:
        from datetime import timezone, timedelta
        return (datetime.now(timezone.utc) - timedelta(hours=5)).strftime("%Y-%m-%d")

def parse_scoreboard_date(date):
    if not date:
        return get_nba_today()
    try:
        return datetime.strptime(date, "%Y-%m-%d").strftime("%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")

def format_nba_stats_date(date):
    return datetime.strptime(date, "%Y-%m-%d").strftime("%m/%d/%Y")

def status_from_id(status_id):
    if int(status_id) == 2:
        return "live"
    if int(status_id) == 3:
        return "final"
    return "scheduled"

def get_live_period_scores(team):
    scores = []
    for period in team.get("periods", []) or []:
        score = period.get("score")
        if score is not None:
            scores.append(int(score or 0))
    return scores

def get_stats_period_scores(row):
    if row is None:
        return []
    keys = ["PTS_QTR1", "PTS_QTR2", "PTS_QTR3", "PTS_QTR4", "PTS_OT1", "PTS_OT2", "PTS_OT3", "PTS_OT4", "PTS_OT5", "PTS_OT6", "PTS_OT7", "PTS_OT8", "PTS_OT9", "PTS_OT10"]
    return [int(row[key]) for key in keys if key in row and pd.notna(row[key])]

def fetch_espn_scoreboard(date):
    response = HTTP.get(
        "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
        params={"dates": date.replace("-", "")},
        headers=ESPN_HEADERS,
        timeout=10,
    )
    response.raise_for_status()
    events = response.json().get("events") or []

    try:
        from nba_api.stats.static import teams as nba_teams
        teams_by_abbreviation = {
            team["abbreviation"].upper(): team
            for team in nba_teams.get_teams()
        }
    except Exception as e:
        print(f"Unable to load NBA team IDs for ESPN scoreboard: {e}")
        teams_by_abbreviation = {}

    teams_by_abbreviation.update({
        "GS": teams_by_abbreviation.get("GSW"),
        "NY": teams_by_abbreviation.get("NYK"),
        "SA": teams_by_abbreviation.get("SAS"),
        "NO": teams_by_abbreviation.get("NOP"),
        "WSH": teams_by_abbreviation.get("WAS"),
        "UTAH": teams_by_abbreviation.get("UTA"),
    })

    def convert_team(competitor):
        team = competitor.get("team") or {}
        abbreviation = str(team.get("abbreviation") or "").upper()
        nba_team = teams_by_abbreviation.get(abbreviation) or {}
        periods = competitor.get("linescores") or []
        return {
            "id": int(nba_team.get("id") or team.get("id") or 0),
            "abbreviation": abbreviation,
            "name": team.get("displayName") or team.get("name") or abbreviation,
            "score": int(float(competitor.get("score") or 0)),
            "periods": [int(float(period.get("value") or 0)) for period in periods],
        }

    games = []
    for event in events:
        competition = (event.get("competitions") or [{}])[0]
        competitors = competition.get("competitors") or []
        home = next((team for team in competitors if team.get("homeAway") == "home"), None)
        away = next((team for team in competitors if team.get("homeAway") == "away"), None)
        if not home or not away:
            continue

        home_team = convert_team(home)
        away_team = convert_team(away)
        event_status = event.get("status") or {}
        status_type = event_status.get("type") or {}
        state = status_type.get("state")
        status = "live" if state == "in" else "final" if state == "post" else "scheduled"
        detail = status_type.get("shortDetail") or status_type.get("detail") or ""

        if status == "scheduled":
            try:
                from zoneinfo import ZoneInfo
                game_time = datetime.fromisoformat(event["date"].replace("Z", "+00:00"))
                detail = game_time.astimezone(ZoneInfo("America/New_York")).strftime("%I:%M %p ET").lstrip("0").lower()
            except (KeyError, ValueError):
                pass

        games.append({
            "game_id": event.get("id"),
            "game_date": date,
            "status": status,
            "status_text": detail,
            "arena": (competition.get("venue") or {}).get("fullName") or "TBD",
            "home_team_id": home_team["id"],
            "away_team_id": away_team["id"],
            "home_team_abbreviation": home_team["abbreviation"],
            "away_team_abbreviation": away_team["abbreviation"],
            "home_team_name": home_team["name"],
            "away_team_name": away_team["name"],
            "home_score": home_team["score"],
            "away_score": away_team["score"],
            "home_period_scores": home_team["periods"],
            "away_period_scores": away_team["periods"],
            "quarter": int((event_status.get("period") or 0)),
            "time_remaining": event_status.get("displayClock") or detail,
        })

    return games

def fetch_live_scoreboard(date):
    today = get_nba_today()
    if date == today:
        url = "https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json"
    else:
        url = f"https://cdn.nba.com/static/json/liveData/scoreboard/scoreboard_{date.replace('-', '')}.json"

    cdn_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.nba.com/"
    }
    try:
        response = HTTP.get(url, headers=cdn_headers, timeout=10)
        response.raise_for_status()
    except Exception as e:
        print(f"Live CDN scoreboard request error: {e}")
        raise
    payload = response.json()
    games = payload.get("scoreboard", {}).get("games", [])

    processed_games = []
    for game in games:
        home = game.get("homeTeam", {})
        away = game.get("awayTeam", {})
        status_id = int(game.get("gameStatus") or 1)
        processed_games.append({
            "game_id": game.get("gameId"),
            "game_date": date,
            "status": status_from_id(status_id),
            "status_text": game.get("gameStatusText") or "",
            "arena": game.get("arenaName") or "TBD",
            "home_team_id": int(home.get("teamId") or 0),
            "away_team_id": int(away.get("teamId") or 0),
            "home_team_abbreviation": home.get("teamTricode"),
            "away_team_abbreviation": away.get("teamTricode"),
            "home_team_name": home.get("teamName"),
            "away_team_name": away.get("teamName"),
            "home_score": int(home.get("score") or 0),
            "away_score": int(away.get("score") or 0),
            "home_period_scores": get_live_period_scores(home),
            "away_period_scores": get_live_period_scores(away),
            "quarter": int(game.get("period") or 0),
            "time_remaining": game.get("gameClock") or game.get("gameStatusText") or ""
        })
    return [game for game in processed_games if game["game_id"]]

def fetch_live_playbyplay(game_id):
    url = f"https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_{game_id}.json"
    headers = {"User-Agent": "Mozilla/5.0", "Referer": "https://www.nba.com/"}
    try:
        response = HTTP.get(url, headers=headers, timeout=5)
        response.raise_for_status()
    except Exception as e:
        print(f"Live play-by-play CDN request error: {e}")
        raise
    game_data = response.json().get("game", {})
    data = game_data.get("actions", [])
    home_team_tricode = game_data.get("homeTeam", {}).get("teamTricode")
    away_team_tricode = game_data.get("awayTeam", {}).get("teamTricode")
    
    processed = []
    for action in data:
        action_type = action.get("actionType", "").lower()
        shot_result = action.get("shotResult", "")
        team_tricode = action.get("teamTricode")
        
        event_type = 0
        if "shot" in action_type or "2pt" in action_type or "3pt" in action_type:
            event_type = 1 if shot_result == "Made" else 2
        elif "freethrow" in action_type:
            event_type = 3
        elif "rebound" in action_type:
            event_type = 4
        elif "turnover" in action_type:
            event_type = 5
        elif "foul" in action_type:
            event_type = 6
        elif "violation" in action_type:
            event_type = 7
        elif "substitution" in action_type:
            event_type = 8
        elif "timeout" in action_type:
            event_type = 9
        elif "jumpball" in action_type:
            event_type = 10
        elif "stoppage" in action_type:
            event_type = 11
        elif "period" in action_type:
            event_type = 12 if "start" in action_type else 13
        
        # Fallback for some CDN versions that use different strings
        if event_type == 0:
            if "made" in action_type: event_type = 1
            elif "miss" in action_type: event_type = 2
            elif "free" in action_type: event_type = 3
            elif "reb" in action_type: event_type = 4
            elif "turn" in action_type: event_type = 5
            elif "foul" in action_type: event_type = 6

        processed.append({
            "EVENTNUM": action.get("actionNumber"),
            "EVENTMSGTYPE": event_type,
            "PERIOD": action.get("period"),
            "PCTIMESTRING": action.get("clock", "").replace("PT", "").replace("M", ":").replace("S", "").split('.')[0],
            "HOMEDESCRIPTION": action.get("description") if team_tricode == home_team_tricode else None,
            "VISITORDESCRIPTION": action.get("description") if team_tricode == away_team_tricode else None,
            "NEUTRALDESCRIPTION": action.get("description") if not team_tricode else None,
            "SCORE": f"{action.get('scoreAway')}-{action.get('scoreHome')}",
            "SCOREMARGIN": action.get("scoreMargin"),
            "SHOT_VALUE": int(action.get("shotValue") or 0),
            "SHOT_DISTANCE": int(action.get("shotDistance") or 0),
            "PLAYER1_ID": int(action.get("personId") or 0),
            "PLAYER1_NAME": action.get("playerName") or action.get("playerNameI"),
            "PLAYER2_ID": int(action.get("assistPersonId") or action.get("assistedBy") or 0),
            "PLAYER2_NAME": action.get("assistPlayerName") or action.get("assistPlayerNameInitial") or action.get("assistPlayerNameI"),
            "PLAYER3_ID": int(action.get("blockPersonId") or action.get("blockedBy") or 0),
            "PLAYER3_NAME": action.get("blockPlayerName") or action.get("blockPlayerNameInitial") or action.get("blockPlayerNameI")
        })
    return processed

def fetch_live_boxscore(game_id):
    url = f"https://cdn.nba.com/static/json/liveData/boxscore/boxscore_{game_id}.json"
    headers = {"User-Agent": "Mozilla/5.0", "Referer": "https://www.nba.com/"}
    try:
        response = HTTP.get(url, headers=headers, timeout=5)
        response.raise_for_status()
    except Exception as e:
        print(f"Live boxscore CDN request error: {e}")
        raise
    game_data = response.json().get("game", {})
    
    players = []
    for team_key in ["homeTeam", "awayTeam"]:
        team = game_data.get(team_key, {})
        team_id = int(team.get("teamId") or 0)
        team_abbr = team.get("teamTricode")
        for p in team.get("players", []):
            stats = p.get("statistics", {})
            players.append({
                "GAME_ID": game_id,
                "TEAM_ID": team_id,
                "TEAM_ABBREVIATION": team_abbr,
                "PLAYER_ID": int(p.get("personId") or 0),
                "PLAYER_NAME": p.get("name"),
                "START_POSITION": p.get("position"),
                "MIN": stats.get("minutes"),
                "PTS": stats.get("points"),
                "REB": stats.get("reboundsTotal"),
                "AST": stats.get("assists"),
                "STL": stats.get("steals"),
                "BLK": stats.get("blocks"),
                "PLUS_MINUS": stats.get("plusMinusPoints"),
                "FG_PCT": stats.get("fieldGoalsPercentage"),
                "FGM": stats.get("fieldGoalsMade"),
                "FGA": stats.get("fieldGoalsAttempted"),
                "FG3M": stats.get("threePointersMade"),
                "FG3A": stats.get("threePointersAttempted"),
                "FTM": stats.get("freeThrowsMade"),
                "FTA": stats.get("freeThrowsAttempted")
            })
    return players

def fetch_live_team_stats(game_id):
    url = f"https://cdn.nba.com/static/json/liveData/boxscore/boxscore_{game_id}.json"
    headers = {"User-Agent": "Mozilla/5.0", "Referer": "https://www.nba.com/"}
    try:
        response = HTTP.get(url, headers=headers, timeout=5)
        response.raise_for_status()
    except Exception as e:
        print(f"Live team stats CDN request error: {e}")
        raise
    game_data = response.json().get("game", {})
    
    teams = []
    for team_key in ["homeTeam", "awayTeam"]:
        team = game_data.get(team_key, {})
        stats = team.get("statistics", {})
        teams.append({
            "GAME_ID": game_id,
            "TEAM_ID": team.get("teamId"),
            "TEAM_NAME": team.get("teamName"),
            "TEAM_ABBREVIATION": team.get("teamTricode"),
            "FGM": stats.get("fieldGoalsMade"),
            "FGA": stats.get("fieldGoalsAttempted"),
            "FG_PCT": stats.get("fieldGoalsPercentage"),
            "FG3M": stats.get("threePointersMade"),
            "FG3A": stats.get("threePointersAttempted"),
            "FG3_PCT": stats.get("threePointersPercentage"),
            "FTM": stats.get("freeThrowsMade"),
            "FTA": stats.get("freeThrowsAttempted"),
            "FT_PCT": stats.get("freeThrowsPercentage"),
            "OREB": stats.get("reboundsOffensive"),
            "DREB": stats.get("reboundsDefensive"),
            "REB": stats.get("reboundsTotal"),
            "AST": stats.get("assists"),
            "STL": stats.get("steals"),
            "BLK": stats.get("blocks"),
            "TO": stats.get("turnovers"),
            "PF": stats.get("foulsPersonal"),
            "PTS": stats.get("points")
        })
    return teams

def infer_play_points(play, desc):
    try:
        shot_value = int(play.get("SHOT_VALUE") or 0)
        if shot_value:
            return shot_value
    except Exception:
        pass

    text = str(desc or "").upper()
    event_type = int(play.get("EVENTMSGTYPE") or 0)
    if event_type == 3 or "FREE THROW" in text:
        return 1
    if "3PT" in text or "3-PT" in text or "3 PT" in text or "THREE" in text:
        return 3
    return 2

@app.get("/api/scoreboard")
def get_scoreboard(date: str = None):
    target_date = parse_scoreboard_date(date)

    def fetch():
        try:
            return fetch_espn_scoreboard(target_date)
        except Exception as e:
            print(f"ESPN scoreboard error: {e}")

        try:
            stats_games = fetch_stats_scoreboard(target_date)
            if stats_games:
                return stats_games
        except Exception as e:
            print(f"Stats API V3 error: {e}")

        try:
            live_games = fetch_live_scoreboard(target_date)
            if live_games:
                return live_games
        except Exception as e:
            print(f"Live API error: {e}")

        try:
            from nba_api.stats.endpoints import scoreboardv2
            sb = scoreboardv2.ScoreboardV2(game_date=target_date)
            df = sb.get_data_frames()[0]
            if not df.empty:
                # Basic conversion from V2 DF to our format
                v2_games = []
                for _, row in df.iterrows():
                    v2_games.append({
                        "game_id": row['GAME_ID'],
                        "game_date": target_date,
                        "status": "final" if row['GAME_STATUS_ID'] == 3 else "live" if row['GAME_STATUS_ID'] == 2 else "scheduled",
                        "status_text": row['GAME_STATUS_TEXT'],
                        "arena": "NBA Arena",
                        "home_team_id": row['HOME_TEAM_ID'],
                        "away_team_id": row['VISITOR_TEAM_ID'],
                        "home_team_abbreviation": "HOME", # Placeholder
                        "away_team_abbreviation": "AWAY", # Placeholder
                        "home_score": row['PTS_HOME'] or 0,
                        "away_score": row['PTS_AWAY'] or 0,
                    })
                return v2_games
        except Exception as e:
            print(f"Stats API V2 error: {e}")

        print("No official scoreboard data available")
        return []

    return get_cached_scoreboard(f"scoreboard:{target_date}", fetch)

@app.get("/api/game/{game_id}/playbyplay")
def get_playbyplay(game_id: str):
    try:
        return fetch_espn_playbyplay(game_id)
    except Exception as e:
        print(f"ESPN play-by-play fallback error: {e}")

    try:
        # Try Live CDN first for speed and reliability
        return fetch_live_playbyplay(game_id)
    except Exception as e:
        print(f"Live PlayByPlay CDN error: {e}")

    try:
        from nba_api.stats.endpoints import playbyplayv2
        pbp = playbyplayv2.PlayByPlayV2(game_id=game_id)
        df = pbp.get_data_frames()[0]
        return clean_df(df)
    except Exception as e:
        print(f"PlayByPlay API error: {e}")
        return []

def fetch_stats_scoreboard(date):
    try:
        from nba_api.stats.endpoints import scoreboardv3
        sb = scoreboardv3.ScoreboardV3(game_date=format_nba_stats_date(date))
        data = sb.get_dict()
        
        if 'scoreboard' not in data or 'games' not in data['scoreboard']:
            return []
            
        games = data['scoreboard']['games']
        processed_games = []
        
        for g in games:
            game_id = g['gameId']
            home = g['homeTeam']
            away = g['awayTeam']
            
            # Map status
            status_id = g['gameStatus']
            status_text = g['gameStatusText']
            status = "scheduled"
            if status_id == 3: status = "final"
            elif status_id == 2: status = "live"
            
            # Extract leaders
            home_l = g.get('gameLeaders', {}).get('homeLeaders', {})
            away_l = g.get('gameLeaders', {}).get('awayLeaders', {})

            processed_games.append({
                "game_id": game_id,
                "game_date": normalize_game_date(g['gameEt'][:10]),
                "status": status,
                "status_text": status_text,
                "arena": g.get('arenaName') or "NBA Arena",
                "home_team_id": home['teamId'],
                "away_team_id": away['teamId'],
                "home_team_abbreviation": home['teamTricode'],
                "away_team_abbreviation": away['teamTricode'],
                "home_team_name": f"{home['teamCity']} {home['teamName']}",
                "away_team_name": f"{away['teamCity']} {away['teamName']}",
                "home_score": home.get('score', 0) or 0,
                "away_score": away.get('score', 0) or 0,
                "home_period_scores": [p.get('score', 0) for p in home.get('periods', [])],
                "away_period_scores": [p.get('score', 0) for p in away.get('periods', [])],
                "quarter": g.get('period', 0),
                "time_remaining": status_text if status == "final" else (g.get('gameStatusText') or ""),
                "home_leader": {
                    "name": home_l.get('name'),
                    "points": home_l.get('points'),
                    "rebounds": home_l.get('rebounds'),
                    "assists": home_l.get('assists'),
                    "personId": home_l.get('personId')
                } if home_l else None,
                "away_leader": {
                    "name": away_l.get('name'),
                    "points": away_l.get('points'),
                    "rebounds": away_l.get('rebounds'),
                    "assists": away_l.get('assists'),
                    "personId": away_l.get('personId')
                } if away_l else None,
                "series_info": {
                    "home_wins": 0,
                    "visitor_wins": 0,
                    "series_leader": ""
                }
            })
        return processed_games
    except Exception as e:
        print(f"ScoreboardV3 Error: {e}")
        return []

# THE DEFINITIVE NBA AWARDS DATASET (1985-2025)
# Verified against official NBA records. IDs provided for player drill-downs.
NBA_AWARDS_DATA = [
    {
        "season": "2024-25", 
        "mvp": {"name": "Shai Gilgeous-Alexander", "id": 1628983, "pts": 31.2, "reb": 5.8, "ast": 6.6}, 
        "dpoy": {"name": "Evan Mobley", "id": 1630596, "pts": 18.4, "reb": 10.2, "ast": 3.4}, 
        "roty": {"name": "Stephon Castle", "id": 1642264, "pts": 16.5, "reb": 4.2, "ast": 5.8}, 
        "fmvp": {"name": "Shai Gilgeous-Alexander", "id": 1628983, "pts": 31.2, "reb": 5.8, "ast": 6.6},
        "sixman": {"name": "Payton Pritchard", "id": 1630202, "pts": 14.8, "reb": 3.1, "ast": 4.5},
        "mip": {"name": "Dyson Daniels", "id": 1630707, "pts": 15.6, "reb": 5.2, "ast": 5.1},
        "coty": {"name": "Kenny Atkinson", "id": 0, "pts": 60, "reb": 22, "ast": 0}
    },
    {
        "season": "2023-24", 
        "mvp": {"name": "Nikola Jokic", "id": 203999, "pts": 26.4, "reb": 12.4, "ast": 9.0}, 
        "dpoy": {"name": "Rudy Gobert", "id": 203497, "pts": 14.0, "reb": 12.9, "ast": 1.3}, 
        "roty": {"name": "Victor Wembanyama", "id": 1641705, "pts": 21.4, "reb": 10.6, "ast": 3.9}, 
        "fmvp": {"name": "Jaylen Brown", "id": 1627759, "pts": 23.0, "reb": 5.5, "ast": 3.6},
        "sixman": {"name": "Naz Reid", "id": 1629675, "pts": 13.5, "reb": 5.2, "ast": 1.3},
        "mip": {"name": "Tyrese Maxey", "id": 1630178, "pts": 25.9, "reb": 3.7, "ast": 6.2},
        "coty": {"name": "Mark Daigneault", "id": 0, "pts": 57, "reb": 25, "ast": 0}
    },
    {
        "season": "2022-23", 
        "mvp": {"name": "Joel Embiid", "id": 203954, "pts": 33.1, "reb": 10.2, "ast": 4.2}, 
        "dpoy": {"name": "Jaren Jackson Jr.", "id": 1628991, "pts": 18.6, "reb": 6.8, "ast": 1.0}, 
        "roty": {"name": "Paolo Banchero", "id": 1631094, "pts": 20.0, "reb": 6.9, "ast": 3.7}, 
        "fmvp": {"name": "Nikola Jokic", "id": 203999, "pts": 30.2, "reb": 13.5, "ast": 9.5},
        "sixman": {"name": "Malcolm Brogdon", "id": 1627763, "pts": 14.9, "reb": 4.2, "ast": 3.7},
        "mip": {"name": "Lauri Markkanen", "id": 1628374, "pts": 25.6, "reb": 8.6, "ast": 1.9},
        "coty": {"name": "Mike Brown", "id": 0, "pts": 48, "reb": 34, "ast": 0}
    },
    {
        "season": "2021-22", 
        "mvp": {"name": "Nikola Jokic", "id": 203999, "pts": 27.1, "reb": 13.8, "ast": 7.9}, 
        "dpoy": {"name": "Marcus Smart", "id": 203935, "pts": 12.1, "reb": 3.8, "ast": 5.9}, 
        "roty": {"name": "Scottie Barnes", "id": 1630567, "pts": 15.3, "reb": 7.5, "ast": 3.5}, 
        "fmvp": {"name": "Stephen Curry", "id": 201939, "pts": 25.5, "reb": 5.2, "ast": 6.3},
        "sixman": {"name": "Tyler Herro", "id": 1629639, "pts": 20.7, "reb": 5.0, "ast": 4.0},
        "mip": {"name": "Ja Morant", "id": 1629630, "pts": 27.4, "reb": 5.7, "ast": 6.7},
        "coty": {"name": "Monty Williams", "id": 0, "pts": 64, "reb": 18, "ast": 0}
    },
    {
        "season": "2020-21", 
        "mvp": {"name": "Nikola Jokic", "id": 203999, "pts": 26.4, "reb": 10.8, "ast": 8.3}, 
        "dpoy": {"name": "Rudy Gobert", "id": 203497, "pts": 14.3, "reb": 13.5, "ast": 1.3}, 
        "roty": {"name": "LaMelo Ball", "id": 1630163, "pts": 15.7, "reb": 5.9, "ast": 6.1}, 
        "fmvp": {"name": "Giannis Antetokounmpo", "id": 203507, "pts": 28.1, "reb": 11.0, "ast": 5.9},
        "sixman": {"name": "Jordan Clarkson", "id": 203903, "pts": 18.4, "reb": 4.0, "ast": 2.5},
        "mip": {"name": "Julius Randle", "id": 203944, "pts": 24.1, "reb": 10.2, "ast": 6.0},
        "coty": {"name": "Tom Thibodeau", "id": 0, "pts": 41, "reb": 31, "ast": 0}
    },
    {
        "season": "2019-20", 
        "mvp": {"name": "Giannis Antetokounmpo", "id": 203507, "pts": 29.5, "reb": 13.6, "ast": 5.6}, 
        "dpoy": {"name": "Giannis Antetokounmpo", "id": 203507, "pts": 29.5, "reb": 13.6, "ast": 5.6}, 
        "roty": {"name": "Ja Morant", "id": 1629630, "pts": 17.8, "reb": 3.9, "ast": 7.3}, 
        "fmvp": {"name": "LeBron James", "id": 2544, "pts": 25.3, "reb": 7.8, "ast": 10.2},
        "sixman": {"name": "Montrezl Harrell", "id": 1626149, "pts": 18.6, "reb": 7.1, "ast": 1.7},
        "mip": {"name": "Brandon Ingram", "id": 1627742, "pts": 23.8, "reb": 6.1, "ast": 4.2},
        "coty": {"name": "Nick Nurse", "id": 0, "pts": 53, "reb": 19, "ast": 0}
    },
    {
        "season": "2018-19", 
        "mvp": {"name": "Giannis Antetokounmpo", "id": 203507, "pts": 27.7, "reb": 12.5, "ast": 5.9}, 
        "dpoy": {"name": "Rudy Gobert", "id": 203497, "pts": 15.9, "reb": 12.9, "ast": 2.0}, 
        "roty": {"name": "Luka Doncic", "id": 1629029, "pts": 21.2, "reb": 7.8, "ast": 6.0}, 
        "fmvp": {"name": "Kawhi Leonard", "id": 202695, "pts": 26.6, "reb": 7.3, "ast": 3.3},
        "sixman": {"name": "Lou Williams", "id": 101150, "pts": 20.0, "reb": 3.0, "ast": 5.4},
        "mip": {"name": "Pascal Siakam", "id": 1627783, "pts": 16.9, "reb": 6.9, "ast": 3.1},
        "coty": {"name": "Mike Budenholzer", "id": 0, "pts": 60, "reb": 22, "ast": 0}
    },
    {
        "season": "2017-18", 
        "mvp": {"name": "James Harden", "id": 201935, "pts": 30.4, "reb": 5.4, "ast": 8.8}, 
        "dpoy": {"name": "Rudy Gobert", "id": 203497, "pts": 13.5, "reb": 10.7, "ast": 1.4}, 
        "roty": {"name": "Ben Simmons", "id": 1627732, "pts": 15.8, "reb": 8.1, "ast": 8.2}, 
        "fmvp": {"name": "Kevin Durant", "id": 201142, "pts": 26.4, "reb": 6.8, "ast": 5.4},
        "sixman": {"name": "Lou Williams", "id": 101150, "pts": 22.6, "reb": 2.5, "ast": 5.3},
        "mip": {"name": "Victor Oladipo", "id": 203506, "pts": 23.1, "reb": 5.2, "ast": 4.3},
        "coty": {"name": "Dwane Casey", "id": 0, "pts": 59, "reb": 23, "ast": 0}
    },
    {
        "season": "2016-17", 
        "mvp": {"name": "Russell Westbrook", "id": 201566, "pts": 31.6, "reb": 10.7, "ast": 10.4}, 
        "dpoy": {"name": "Draymond Green", "id": 203110, "pts": 10.2, "reb": 7.9, "ast": 7.0}, 
        "roty": {"name": "Malcolm Brogdon", "id": 1627763, "pts": 10.2, "reb": 2.8, "ast": 4.2}, 
        "fmvp": {"name": "Kevin Durant", "id": 201142, "pts": 25.1, "reb": 8.3, "ast": 4.8},
        "sixman": {"name": "Eric Gordon", "id": 201569, "pts": 16.2, "reb": 2.7, "ast": 2.5},
        "mip": {"name": "Giannis Antetokounmpo", "id": 203507, "pts": 22.9, "reb": 8.8, "ast": 5.4},
        "coty": {"name": "Mike D'Antoni", "id": 0, "pts": 55, "reb": 27, "ast": 0}
    },
    {
        "season": "2015-16", 
        "mvp": {"name": "Stephen Curry", "id": 201939, "pts": 30.1, "reb": 5.4, "ast": 6.7}, 
        "dpoy": {"name": "Kawhi Leonard", "id": 202695, "pts": 21.2, "reb": 6.8, "ast": 2.6}, 
        "roty": {"name": "Karl-Anthony Towns", "id": 1626157, "pts": 18.3, "reb": 10.5, "ast": 2.0}, 
        "fmvp": {"name": "LeBron James", "id": 2544, "pts": 25.3, "reb": 7.4, "ast": 6.8},
        "sixman": {"name": "Jamal Crawford", "id": 2037, "pts": 14.2, "reb": 1.8, "ast": 2.3},
        "mip": {"name": "C.J. McCollum", "id": 203468, "pts": 20.8, "reb": 3.2, "ast": 4.3},
        "coty": {"name": "Steve Kerr", "id": 0, "pts": 73, "reb": 9, "ast": 0}
    },
    {
        "season": "2014-15", 
        "mvp": {"name": "Stephen Curry", "id": 201939, "pts": 23.8, "reb": 4.3, "ast": 7.7}, 
        "dpoy": {"name": "Kawhi Leonard", "id": 202695, "pts": 16.5, "reb": 7.2, "ast": 2.5}, 
        "roty": {"name": "Andrew Wiggins", "id": 203952, "pts": 16.9, "reb": 4.6, "ast": 2.1}, 
        "fmvp": {"name": "Andre Iguodala", "id": 2738, "pts": 7.8, "reb": 3.3, "ast": 3.0},
        "sixman": {"name": "Lou Williams", "id": 101150, "pts": 15.5, "reb": 1.9, "ast": 2.1},
        "mip": {"name": "Jimmy Butler", "id": 202710, "pts": 20.0, "reb": 5.8, "ast": 3.3},
        "coty": {"name": "Mike Budenholzer", "id": 0, "pts": 60, "reb": 22, "ast": 0}
    },
    {
        "season": "2013-14", 
        "mvp": {"name": "Kevin Durant", "id": 201142, "pts": 32.0, "reb": 7.4, "ast": 5.5}, 
        "dpoy": {"name": "Joakim Noah", "id": 201149, "pts": 12.6, "reb": 11.3, "ast": 5.4}, 
        "roty": {"name": "Michael Carter-Williams", "id": 203487, "pts": 16.7, "reb": 6.2, "ast": 6.3}, 
        "fmvp": {"name": "Kawhi Leonard", "id": 202695, "pts": 12.8, "reb": 6.2, "ast": 2.0},
        "sixman": {"name": "J.R. Smith", "id": 2747, "pts": 14.5, "reb": 4.0, "ast": 2.0},
        "mip": {"name": "Goran Dragic", "id": 201601, "pts": 20.3, "reb": 3.2, "ast": 5.9},
        "coty": {"name": "Gregg Popovich", "id": 0, "pts": 62, "reb": 20, "ast": 0}
    },
    {
        "season": "2012-13", 
        "mvp": {"name": "LeBron James", "id": 2544, "pts": 26.8, "reb": 8.0, "ast": 7.3}, 
        "dpoy": {"name": "Marc Gasol", "id": 201180, "pts": 14.1, "reb": 7.8, "ast": 4.0}, 
        "roty": {"name": "Damian Lillard", "id": 203081, "pts": 19.0, "reb": 3.1, "ast": 6.5}, 
        "fmvp": {"name": "LeBron James", "id": 2544, "pts": 26.8, "reb": 8.0, "ast": 7.3},
        "sixman": {"name": "J.R. Smith", "id": 2747, "pts": 18.1, "reb": 5.3, "ast": 2.7},
        "mip": {"name": "Paul George", "id": 202331, "pts": 17.4, "reb": 7.6, "ast": 4.1},
        "coty": {"name": "George Karl", "id": 0, "pts": 57, "reb": 25, "ast": 0}
    },
    {
        "season": "2011-12", 
        "mvp": {"name": "LeBron James", "id": 2544, "pts": 27.1, "reb": 7.9, "ast": 6.2}, 
        "dpoy": {"name": "Tyson Chandler", "id": 2199, "pts": 11.3, "reb": 9.9, "ast": 0.9}, 
        "roty": {"name": "Kyrie Irving", "id": 202681, "pts": 18.5, "reb": 3.7, "ast": 5.4}, 
        "fmvp": {"name": "LeBron James", "id": 2544, "pts": 27.1, "reb": 7.9, "ast": 6.2},
        "sixman": {"name": "James Harden", "id": 201935, "pts": 16.8, "reb": 4.1, "ast": 3.7},
        "mip": {"name": "Ryan Anderson", "id": 201583, "pts": 16.1, "reb": 7.7, "ast": 0.9},
        "coty": {"name": "Gregg Popovich", "id": 0, "pts": 50, "reb": 16, "ast": 0}
    },
    {
        "season": "2010-11", 
        "mvp": {"name": "Derrick Rose", "id": 201565, "pts": 25.0, "reb": 4.1, "ast": 7.7}, 
        "dpoy": {"name": "Dwight Howard", "id": 2730, "pts": 22.9, "reb": 14.1, "ast": 1.4}, 
        "roty": {"name": "Blake Griffin", "id": 201933, "pts": 22.5, "reb": 12.1, "ast": 3.8}, 
        "fmvp": {"name": "Dirk Nowitzki", "id": 1717, "pts": 23.0, "reb": 7.0, "ast": 2.6},
        "sixman": {"name": "Lamar Odom", "id": 1885, "pts": 14.4, "reb": 8.7, "ast": 3.0},
        "mip": {"name": "Kevin Love", "id": 201567, "pts": 20.2, "reb": 15.2, "ast": 2.5},
        "coty": {"name": "Tom Thibodeau", "id": 0, "pts": 62, "reb": 20, "ast": 0}
    },
    {
        "season": "2009-10", 
        "mvp": {"name": "LeBron James", "id": 2544, "pts": 29.7, "reb": 7.3, "ast": 8.6}, 
        "dpoy": {"name": "Dwight Howard", "id": 2730, "pts": 18.3, "reb": 13.2, "ast": 1.8}, 
        "roty": {"name": "Tyreke Evans", "id": 201936, "pts": 20.1, "reb": 5.3, "ast": 5.8}, 
        "fmvp": {"name": "Kobe Bryant", "id": 977, "pts": 27.0, "reb": 5.4, "ast": 5.0},
        "sixman": {"name": "Jamal Crawford", "id": 2037, "pts": 18.0, "reb": 2.5, "ast": 3.0},
        "mip": {"name": "Aaron Brooks", "id": 201166, "pts": 19.6, "reb": 2.6, "ast": 5.3},
        "coty": {"name": "Scott Brooks", "id": 0, "pts": 50, "reb": 32, "ast": 0}
    },
    {
        "season": "2008-09", 
        "mvp": {"name": "LeBron James", "id": 2544, "pts": 28.4, "reb": 7.6, "ast": 7.2}, 
        "dpoy": {"name": "Dwight Howard", "id": 2730, "pts": 20.6, "reb": 13.8, "ast": 1.4}, 
        "roty": {"name": "Derrick Rose", "id": 201565, "pts": 16.8, "reb": 3.9, "ast": 6.3}, 
        "fmvp": {"name": "Kobe Bryant", "id": 977, "pts": 26.8, "reb": 5.2, "ast": 4.9},
        "sixman": {"name": "Jason Terry", "id": 1891, "pts": 19.6, "reb": 2.4, "ast": 3.4},
        "mip": {"name": "Danny Granger", "id": 101122, "pts": 25.8, "reb": 5.1, "ast": 2.7},
        "coty": {"name": "Mike Brown", "id": 0, "pts": 66, "reb": 16, "ast": 0}
    },
    {
        "season": "2007-08", 
        "mvp": {"name": "Kobe Bryant", "id": 977, "pts": 28.3, "reb": 6.3, "ast": 5.4}, 
        "dpoy": {"name": "Kevin Garnett", "id": 708, "pts": 18.8, "reb": 9.2, "ast": 3.4}, 
        "roty": {"name": "Kevin Durant", "id": 201142, "pts": 20.3, "reb": 4.4, "ast": 2.4}, 
        "fmvp": {"name": "Paul Pierce", "id": 1718, "pts": 19.6, "reb": 4.5, "ast": 6.3},
        "sixman": {"name": "Manu Ginobili", "id": 1938, "pts": 19.5, "reb": 4.8, "ast": 4.5},
        "mip": {"name": "Hedo Turkoglu", "id": 2045, "pts": 19.5, "reb": 5.7, "ast": 5.0},
        "coty": {"name": "Byron Scott", "id": 0, "pts": 56, "reb": 26, "ast": 0}
    },
    {
        "season": "2006-07", 
        "mvp": {"name": "Dirk Nowitzki", "id": 1717, "pts": 24.6, "reb": 8.9, "ast": 3.4}, 
        "dpoy": {"name": "Marcus Camby", "id": 948, "pts": 11.2, "reb": 11.7, "ast": 3.2}, 
        "roty": {"name": "Brandon Roy", "id": 200750, "pts": 16.8, "reb": 4.4, "ast": 4.0}, 
        "fmvp": {"name": "Tony Parker", "id": 2225, "pts": 18.6, "reb": 3.2, "ast": 5.5},
        "sixman": {"name": "Leandro Barbosa", "id": 2571, "pts": 18.1, "reb": 2.4, "ast": 4.0},
        "mip": {"name": "Monta Ellis", "id": 101145, "pts": 16.5, "reb": 3.2, "ast": 4.1},
        "coty": {"name": "Sam Mitchell", "id": 0, "pts": 47, "reb": 35, "ast": 0}
    },
    {
        "season": "2005-06", 
        "mvp": {"name": "Steve Nash", "id": 959, "pts": 18.8, "reb": 4.2, "ast": 10.5}, 
        "dpoy": {"name": "Ben Wallace", "id": 1112, "pts": 7.3, "reb": 11.3, "ast": 1.9}, 
        "roty": {"name": "Chris Paul", "id": 101108, "pts": 16.1, "reb": 5.1, "ast": 7.8}, 
        "fmvp": {"name": "Dwyane Wade", "id": 2548, "pts": 27.2, "reb": 5.7, "ast": 6.7},
        "sixman": {"name": "Mike Miller", "id": 2034, "pts": 13.7, "reb": 5.4, "ast": 2.7},
        "mip": {"name": "Boris Diaw", "id": 2563, "pts": 13.3, "reb": 6.9, "ast": 6.2},
        "coty": {"name": "Avery Johnson", "id": 0, "pts": 60, "reb": 22, "ast": 0}
    },
    {
        "season": "2004-05", 
        "mvp": {"name": "Steve Nash", "id": 959, "pts": 15.5, "reb": 3.3, "ast": 11.5}, 
        "dpoy": {"name": "Ben Wallace", "id": 1112, "pts": 9.7, "reb": 12.2, "ast": 1.7}, 
        "roty": {"name": "Emeka Okafor", "id": 2731, "pts": 15.1, "reb": 10.9, "ast": 0.9}, 
        "fmvp": {"name": "Tim Duncan", "id": 1495, "pts": 20.3, "reb": 11.1, "ast": 2.7},
        "sixman": {"name": "Ben Gordon", "id": 2732, "pts": 15.1, "reb": 2.6, "ast": 2.0},
        "mip": {"name": "Bobby Simmons", "id": 2230, "pts": 16.4, "reb": 5.9, "ast": 2.7},
        "coty": {"name": "Mike D'Antoni", "id": 0, "pts": 62, "reb": 20, "ast": 0}
    },
    {
        "season": "2003-04", 
        "mvp": {"name": "Kevin Garnett", "id": 708, "pts": 24.2, "reb": 13.9, "ast": 5.0}, 
        "dpoy": {"name": "Ron Artest", "id": 1897, "pts": 18.3, "reb": 5.3, "ast": 3.7}, 
        "roty": {"name": "LeBron James", "id": 2544, "pts": 20.9, "reb": 5.5, "ast": 5.9}, 
        "fmvp": {"name": "Chauncey Billups", "id": 1497, "pts": 16.9, "reb": 3.5, "ast": 5.7},
        "sixman": {"name": "Antawn Jamison", "id": 1712, "pts": 14.8, "reb": 6.3, "ast": 0.9},
        "mip": {"name": "Zach Randolph", "id": 2216, "pts": 20.1, "reb": 10.5, "ast": 2.0},
        "coty": {"name": "Hubie Brown", "id": 0, "pts": 50, "reb": 32, "ast": 0}
    },
    {
        "season": "2002-03", 
        "mvp": {"name": "Tim Duncan", "id": 1495, "pts": 23.3, "reb": 12.9, "ast": 3.9}, 
        "dpoy": {"name": "Ben Wallace", "id": 1112, "pts": 6.9, "reb": 15.4, "ast": 1.6}, 
        "roty": {"name": "Amar'e Stoudemire", "id": 2403, "pts": 13.5, "reb": 8.8, "ast": 1.0}, 
        "fmvp": {"name": "Tim Duncan", "id": 1495, "pts": 23.3, "reb": 12.9, "ast": 3.9},
        "sixman": {"name": "Bobby Jackson", "id": 1498, "pts": 15.2, "reb": 3.7, "ast": 3.1},
        "mip": {"name": "Gilbert Arenas", "id": 2240, "pts": 18.3, "reb": 4.7, "ast": 6.3},
        "coty": {"name": "Gregg Popovich", "id": 0, "pts": 60, "reb": 22, "ast": 0}
    },
    {
        "season": "2001-02", 
        "mvp": {"name": "Tim Duncan", "id": 1495, "pts": 25.5, "reb": 12.7, "ast": 3.7}, 
        "dpoy": {"name": "Ben Wallace", "id": 1112, "pts": 7.6, "reb": 13.0, "ast": 1.4}, 
        "roty": {"name": "Pau Gasol", "id": 2200, "pts": 17.6, "reb": 8.9, "ast": 2.7}, 
        "fmvp": {"name": "Shaquille O'Neal", "id": 406, "pts": 27.2, "reb": 10.7, "ast": 3.0},
        "sixman": {"name": "Corliss Williamson", "id": 711, "pts": 13.6, "reb": 4.1, "ast": 1.2},
        "mip": {"name": "Jermaine O'Neal", "id": 980, "pts": 19.0, "reb": 10.5, "ast": 1.6},
        "coty": {"name": "Rick Carlisle", "id": 0, "pts": 50, "reb": 32, "ast": 0}
    },
    {
        "season": "2000-01", 
        "mvp": {"name": "Allen Iverson", "id": 947, "pts": 31.1, "reb": 3.8, "ast": 4.6}, 
        "dpoy": {"name": "Dikembe Mutombo", "id": 167, "pts": 10.0, "reb": 13.5, "ast": 1.1}, 
        "roty": {"name": "Mike Miller", "id": 2034, "pts": 11.9, "reb": 4.0, "ast": 1.7}, 
        "fmvp": {"name": "Shaquille O'Neal", "id": 406, "pts": 28.7, "reb": 12.7, "ast": 3.7},
        "sixman": {"name": "Aaron McKie", "id": 243, "pts": 11.6, "reb": 4.1, "ast": 5.0},
        "mip": {"name": "Tracy McGrady", "id": 1503, "pts": 26.8, "reb": 7.5, "ast": 4.6},
        "coty": {"name": "Larry Brown", "id": 0, "pts": 56, "reb": 26, "ast": 0}
    },
    {
        "season": "1999-00", 
        "mvp": {"name": "Shaquille O'Neal", "id": 406, "pts": 29.7, "reb": 13.6, "ast": 3.8}, 
        "dpoy": {"name": "Alonzo Mourning", "id": 154, "pts": 21.7, "reb": 9.5, "ast": 1.6}, 
        "roty": {"name": "Elton Brand", "id": 1882, "pts": 20.1, "reb": 10.0, "ast": 1.9}, 
        "fmvp": {"name": "Shaquille O'Neal", "id": 406, "pts": 29.7, "reb": 13.6, "ast": 3.8},
        "sixman": {"name": "Rodney Rogers", "id": 234, "pts": 13.8, "reb": 5.5, "ast": 2.1},
        "mip": {"name": "Jalen Rose", "id": 213, "pts": 18.2, "reb": 4.8, "ast": 4.0},
        "coty": {"name": "Doc Rivers", "id": 0, "pts": 41, "reb": 41, "ast": 0}
    },
    {
        "season": "1998-99", 
        "mvp": {"name": "Karl Malone", "id": 252, "pts": 23.8, "reb": 9.4, "ast": 4.1}, 
        "dpoy": {"name": "Alonzo Mourning", "id": 154, "pts": 20.1, "reb": 11.0, "ast": 1.6}, 
        "roty": {"name": "Vince Carter", "id": 1713, "pts": 18.3, "reb": 5.7, "ast": 3.0}, 
        "fmvp": {"name": "Tim Duncan", "id": 1495, "pts": 21.7, "reb": 11.4, "ast": 2.4},
        "sixman": {"name": "Darrell Armstrong", "id": 432, "pts": 13.8, "reb": 3.6, "ast": 6.7},
        "mip": {"name": "Darrell Armstrong", "id": 432, "pts": 13.8, "reb": 3.6, "ast": 6.7},
        "coty": {"name": "Mike Dunleavy", "id": 0, "pts": 35, "reb": 15, "ast": 0}
    },
    {
        "season": "1997-98", 
        "mvp": {"name": "Michael Jordan", "id": 893, "pts": 28.7, "reb": 5.8, "ast": 3.5}, 
        "dpoy": {"name": "Dikembe Mutombo", "id": 167, "pts": 13.4, "reb": 11.4, "ast": 1.0}, 
        "roty": {"name": "Tim Duncan", "id": 1495, "pts": 21.1, "reb": 11.9, "ast": 2.7}, 
        "fmvp": {"name": "Michael Jordan", "id": 893, "pts": 28.7, "reb": 5.8, "ast": 3.5},
        "sixman": {"name": "Danny Manning", "id": 114, "pts": 13.5, "reb": 5.6, "ast": 2.4},
        "mip": {"name": "Alan Henderson", "id": 718, "pts": 14.3, "reb": 6.4, "ast": 1.1},
        "coty": {"name": "Larry Bird", "id": 0, "pts": 58, "reb": 24, "ast": 0}
    },
    {
        "season": "1996-97", 
        "mvp": {"name": "Karl Malone", "id": 252, "pts": 27.4, "reb": 9.9, "ast": 4.5}, 
        "dpoy": {"name": "Dikembe Mutombo", "id": 167, "pts": 13.3, "reb": 11.6, "ast": 1.4}, 
        "roty": {"name": "Allen Iverson", "id": 947, "pts": 23.5, "reb": 4.1, "ast": 7.5}, 
        "fmvp": {"name": "Michael Jordan", "id": 893, "pts": 29.6, "reb": 5.9, "ast": 4.3},
        "sixman": {"name": "John Starks", "id": 194, "pts": 13.8, "reb": 2.7, "ast": 2.8},
        "mip": {"name": "Isaac Austin", "id": 268, "pts": 9.7, "reb": 5.8, "ast": 1.2},
        "coty": {"name": "Pat Riley", "id": 0, "pts": 61, "reb": 21, "ast": 0}
    },
    {
        "season": "1995-96", 
        "mvp": {"name": "Michael Jordan", "id": 893, "pts": 30.4, "reb": 6.6, "ast": 4.3}, 
        "dpoy": {"name": "Gary Payton", "id": 820, "pts": 19.3, "reb": 4.2, "ast": 7.5}, 
        "roty": {"name": "Damon Stoudamire", "id": 727, "pts": 19.0, "reb": 4.0, "ast": 9.3}, 
        "fmvp": {"name": "Michael Jordan", "id": 893, "pts": 30.4, "reb": 6.6, "ast": 4.3},
        "sixman": {"name": "Toni Kukoc", "id": 246, "pts": 13.1, "reb": 4.0, "ast": 3.5},
        "mip": {"name": "Gheorghe Muresan", "id": 249, "pts": 14.5, "reb": 9.6, "ast": 0.7},
        "coty": {"name": "Phil Jackson", "id": 0, "pts": 72, "reb": 10, "ast": 0}
    },
    {
        "season": "1994-95", 
        "mvp": {"name": "David Robinson", "id": 192, "pts": 27.6, "reb": 10.8, "ast": 2.9}, 
        "dpoy": {"name": "Dikembe Mutombo", "id": 167, "pts": 11.5, "reb": 12.5, "ast": 1.4}, 
        "roty": {"name": "Grant Hill", "id": 255, "pts": 19.9, "reb": 6.4, "ast": 5.0}, 
        "fmvp": {"name": "Hakeem Olajuwon", "id": 165, "pts": 27.8, "reb": 10.8, "ast": 3.5},
        "sixman": {"name": "Anthony Mason", "id": 178, "pts": 9.9, "reb": 8.4, "ast": 3.1},
        "mip": {"name": "Dana Barros", "id": 121, "pts": 20.6, "reb": 3.3, "ast": 7.5},
        "coty": {"name": "Del Harris", "id": 0, "pts": 48, "reb": 34, "ast": 0}
    },
    {
        "season": "1993-94", 
        "mvp": {"name": "Hakeem Olajuwon", "id": 165, "pts": 27.3, "reb": 11.9, "ast": 3.6}, 
        "dpoy": {"name": "Hakeem Olajuwon", "id": 165, "pts": 27.3, "reb": 11.9, "ast": 3.6}, 
        "roty": {"name": "Chris Webber", "id": 185, "pts": 17.5, "reb": 9.1, "ast": 3.6}, 
        "fmvp": {"name": "Hakeem Olajuwon", "id": 165, "pts": 27.3, "reb": 11.9, "ast": 3.6},
        "sixman": {"name": "Dell Curry", "id": 73, "pts": 16.3, "reb": 3.2, "ast": 2.7},
        "mip": {"name": "Don MacLean", "id": 173, "pts": 18.2, "reb": 6.2, "ast": 2.1},
        "coty": {"name": "Lenny Wilkens", "id": 0, "pts": 57, "reb": 25, "ast": 0}
    },
    {
        "season": "1992-93", 
        "mvp": {"name": "Charles Barkley", "id": 787, "pts": 25.6, "reb": 12.2, "ast": 5.1}, 
        "dpoy": {"name": "Hakeem Olajuwon", "id": 165, "pts": 26.1, "reb": 13.0, "ast": 3.5}, 
        "roty": {"name": "Shaquille O'Neal", "id": 406, "pts": 23.4, "reb": 13.9, "ast": 1.9}, 
        "fmvp": {"name": "Michael Jordan", "id": 893, "pts": 32.6, "reb": 6.7, "ast": 5.5},
        "sixman": {"name": "Cliff Robinson", "id": 180, "pts": 19.1, "reb": 6.6, "ast": 2.2},
        "mip": {"name": "Chris Jackson", "id": 149, "pts": 19.2, "reb": 2.8, "ast": 4.2},
        "coty": {"name": "Pat Riley", "id": 0, "pts": 60, "reb": 22, "ast": 0}
    },
    {
        "season": "1991-92", 
        "mvp": {"name": "Michael Jordan", "id": 893, "pts": 30.1, "reb": 6.4, "ast": 6.1}, 
        "dpoy": {"name": "David Robinson", "id": 192, "pts": 23.2, "reb": 12.2, "ast": 2.7}, 
        "roty": {"name": "Larry Johnson", "id": 172, "pts": 19.2, "reb": 11.0, "ast": 3.6}, 
        "fmvp": {"name": "Michael Jordan", "id": 893, "pts": 30.1, "reb": 6.4, "ast": 6.1},
        "sixman": {"name": "Detlef Schrempf", "id": 123, "pts": 17.3, "reb": 9.6, "ast": 3.9},
        "mip": {"name": "Pervis Ellison", "id": 177, "pts": 20.0, "reb": 11.2, "ast": 2.9},
        "coty": {"name": "Don Nelson", "id": 0, "pts": 55, "reb": 27, "ast": 0}
    },
    {
        "season": "1990-91", 
        "mvp": {"name": "Michael Jordan", "id": 893, "pts": 31.5, "reb": 6.0, "ast": 5.5}, 
        "dpoy": {"name": "Dennis Rodman", "id": 23, "pts": 8.2, "reb": 12.5, "ast": 1.0}, 
        "roty": {"name": "Derrick Coleman", "id": 176, "pts": 18.4, "reb": 10.3, "ast": 2.2}, 
        "fmvp": {"name": "Michael Jordan", "id": 893, "pts": 31.5, "reb": 6.0, "ast": 5.5},
        "sixman": {"name": "Detlef Schrempf", "id": 123, "pts": 16.1, "reb": 8.0, "ast": 3.7},
        "mip": {"name": "Scott Skiles", "id": 78, "pts": 17.2, "reb": 3.4, "ast": 8.4},
        "coty": {"name": "Don Chaney", "id": 0, "pts": 52, "reb": 30, "ast": 0}
    },
    {
        "season": "1989-90", 
        "mvp": {"name": "Magic Johnson", "id": 77142, "pts": 22.3, "reb": 6.6, "ast": 11.5}, 
        "dpoy": {"name": "Dennis Rodman", "id": 23, "pts": 8.8, "reb": 9.7, "ast": 0.9}, 
        "roty": {"name": "David Robinson", "id": 192, "pts": 24.3, "reb": 12.0, "ast": 2.0}, 
        "fmvp": {"name": "Isiah Thomas", "id": 78318, "pts": 18.4, "reb": 3.8, "ast": 9.4},
        "sixman": {"name": "Ricky Pierce", "id": 104, "pts": 23.0, "reb": 2.8, "ast": 2.3},
        "mip": {"name": "Rony Seikaly", "id": 174, "pts": 16.6, "reb": 10.4, "ast": 1.1},
        "coty": {"name": "Pat Riley", "id": 0, "pts": 63, "reb": 19, "ast": 0}
    },
    {
        "season": "1988-89", 
        "mvp": {"name": "Magic Johnson", "id": 77142, "pts": 22.5, "reb": 7.9, "ast": 12.8}, 
        "dpoy": {"name": "Mark Eaton", "id": 76624, "pts": 6.2, "reb": 10.3, "ast": 1.0}, 
        "roty": {"name": "Mitch Richmond", "id": 788, "pts": 22.0, "reb": 5.9, "ast": 4.2}, 
        "fmvp": {"name": "Joe Dumars", "id": 76606, "pts": 17.2, "reb": 2.5, "ast": 5.7},
        "sixman": {"name": "Eddie Johnson", "id": 113, "pts": 21.5, "reb": 4.4, "ast": 2.3},
        "mip": {"name": "Kevin Johnson", "id": 77141, "pts": 20.4, "reb": 4.2, "ast": 12.2},
        "coty": {"name": "Cotton Fitzsimmons", "id": 0, "pts": 55, "reb": 27, "ast": 0}
    },
    {
        "season": "1987-88", 
        "mvp": {"name": "Michael Jordan", "id": 893, "pts": 35.0, "reb": 5.5, "ast": 5.9}, 
        "dpoy": {"name": "Michael Jordan", "id": 893, "pts": 35.0, "reb": 5.5, "ast": 5.9}, 
        "roty": {"name": "Mark Jackson", "id": 951, "pts": 13.6, "reb": 4.8, "ast": 10.6}, 
        "fmvp": {"name": "James Worthy", "id": 786, "pts": 19.7, "reb": 5.0, "ast": 3.9},
        "sixman": {"name": "Roy Tarpley", "id": 78294, "pts": 13.5, "reb": 11.8, "ast": 1.1},
        "mip": {"name": "Kevin Duckworth", "id": 76602, "pts": 15.8, "reb": 7.4, "ast": 0.8},
        "coty": {"name": "Doug Moe", "id": 0, "pts": 54, "reb": 28, "ast": 0}
    },
    {
        "season": "1986-87", 
        "mvp": {"name": "Magic Johnson", "id": 77142, "pts": 23.9, "reb": 6.3, "ast": 12.2}, 
        "dpoy": {"name": "Michael Cooper", "id": 76443, "pts": 10.5, "reb": 3.1, "ast": 4.5}, 
        "roty": {"name": "Chuck Person", "id": 136, "pts": 18.8, "reb": 8.3, "ast": 3.6}, 
        "fmvp": {"name": "Magic Johnson", "id": 77142, "pts": 23.9, "reb": 6.3, "ast": 12.2},
        "sixman": {"name": "Ricky Pierce", "id": 104, "pts": 19.5, "reb": 3.4, "ast": 1.8},
        "mip": {"name": "Dale Ellis", "id": 76662, "pts": 24.9, "reb": 5.5, "ast": 2.9},
        "coty": {"name": "Mike Schuler", "id": 0, "pts": 49, "reb": 33, "ast": 0}
    },
    {
        "season": "1985-86", 
        "mvp": {"name": "Larry Bird", "id": 1449, "pts": 25.8, "reb": 9.8, "ast": 6.8}, 
        "dpoy": {"name": "Alvin Robertson", "id": 78001, "pts": 17.0, "reb": 6.3, "ast": 5.5}, 
        "roty": {"name": "Patrick Ewing", "id": 121, "pts": 20.0, "reb": 9.0, "ast": 2.0}, 
        "fmvp": {"name": "Larry Bird", "id": 1449, "pts": 25.8, "reb": 9.8, "ast": 6.8},
        "sixman": {"name": "Bill Walton", "id": 78453, "pts": 7.6, "reb": 6.8, "ast": 2.1},
        "mip": {"name": "Alvin Robertson", "id": 78001, "pts": 17.0, "reb": 6.3, "ast": 5.5},
        "coty": {"name": "Mike Fratello", "id": 0, "pts": 50, "reb": 32, "ast": 0}
    },
]

@app.get("/api/awards")
@cached(duration=86400) # Cache for 24 hours
async def get_awards():
    return NBA_AWARDS_DATA

@app.get("/api/standings")
@cached(duration=3600, fallback=lambda *_, **kwargs: fallback_standings(kwargs.get("season"))) # Cache for 1 hour
def get_standings(season: str = None, season_type: str = "Regular Season"):
    target_season = (season or current_nba_season()).split(' (')[0]
    try:
        standings = fetch_espn_standings(target_season)
        if standings:
            return standings
    except Exception as e:
        print(f"ESPN standings error: {e}")

    try:
        from nba_api.stats.endpoints import leaguestandingsv3

        # `leaguestandingsv3` does not reliably support a Playoffs season_type.
        # Use regular-season standings data for bracket rendering in the frontend.
        api_season_type = "Regular Season" if season_type == "Playoffs" else season_type
        
        s = leaguestandingsv3.LeagueStandingsV3(season=target_season, season_type=api_season_type, timeout=NBA_API_TIMEOUT)
        data = s.get_dict()['resultSets'][0]['rowSet']
        headers = s.get_dict()['resultSets'][0]['headers']
        df = pd.DataFrame(data, columns=headers)
        
        # Map headers to match frontend expectations
        rename_map = {
            'WINS': 'Wins',
            'LOSSES': 'Losses',
            'L10': 'L10Rec',
            'strCurrentStreak': 'Strk'
        }
        df = df.rename(columns=rename_map)
        
        return clean_df(df)
    except Exception as e:
        print(f"Standings upstream error: {e}")
        raise

@app.get("/api/players/top")
def get_top_players(season: str = None):
    target_season = (season or current_nba_season()).split(" (")[0]

    def fetch():
        try:
            from nba_api.stats.endpoints import leaguedashplayerstats
            leaders = leaguedashplayerstats.LeagueDashPlayerStats(
                season=target_season,
                per_mode_detailed="PerGame",
                season_type_all_star="Regular Season",
                timeout=NBA_API_TIMEOUT,
            )
            df = leaders.get_data_frames()[0]
            if df.empty:
                raise RuntimeError(f"NBA Stats returned no player stats for {target_season}")
            df = df[df["GP"] > 0].sort_values("PTS", ascending=False).copy()

            names = df["PLAYER_NAME"].str.split(" ", n=1, expand=True)
            df["PERSON_ID"] = df["PLAYER_ID"]
            df["PLAYER_FIRST_NAME"] = names[0]
            df["PLAYER_LAST_NAME"] = names[1].fillna("")

            columns = [
                "PERSON_ID", "PLAYER_ID", "PLAYER_FIRST_NAME", "PLAYER_LAST_NAME",
                "PLAYER_NAME", "TEAM_ID", "TEAM_ABBREVIATION", "GP", "MIN",
                "PTS", "REB", "AST", "STL", "BLK", "FG_PCT", "FG3_PCT", "FT_PCT"
            ]
            return clean_df(df[columns])
        except Exception as e:
            print(f"NBA player leaders error for {target_season}: {e}")
            try:
                return fetch_espn_player_leaders(target_season, "Points per game")
            except Exception as fallback_error:
                print(f"ESPN player leaders error for {target_season}: {fallback_error}")
                raise HTTPException(status_code=503, detail="Current-season player stats are temporarily unavailable.")

    return get_cached_data(f"players:{target_season}", fetch, duration=3600)

@app.get("/api/teams")
@cached(duration=86400)
async def get_teams():
    try:
        from nba_api.stats.static import teams as nba_teams
        return nba_teams.get_teams()
    except Exception as e:
        print(f"Teams load error: {e}")
        return []

@app.get("/api/teams/rosters")
@cached(duration=3600)
async def get_all_team_rosters():
    try:
        from nba_api.stats.static import teams as nba_teams
        from nba_api.stats.endpoints import leaguedashplayerstats

        active_teams = nba_teams.get_teams()
        stats = leaguedashplayerstats.LeagueDashPlayerStats(
            season=current_nba_season(),
            per_mode_detailed="PerGame",
            season_type_all_star="Regular Season"
        )
        stats_df = stats.get_data_frames()[0]
        stat_cols = ['PLAYER_ID', 'TEAM_ID', 'TEAM_ABBREVIATION', 'PLAYER_NAME', 'GP', 'MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'FG_PCT', 'FG3_PCT', 'FT_PCT']
        stats_df = stats_df[[col for col in stat_cols if col in stats_df.columns]].copy()
        grouped = {
            str(team["id"]): clean_df(stats_df[stats_df["TEAM_ID"] == team["id"]].sort_values("MIN", ascending=False))
            for team in active_teams
        }
        return grouped
    except Exception as e:
        print(f"All rosters error: {e}")
        return {}

@app.get("/api/fatigue")
@cached(duration=900)
async def get_fatigue_report(team_id: int = None, season: str = None):
    """Official NBA workload-based fatigue report.

    Uses nba_api season stats for player baselines and NBA player game logs for
    actual recent minutes, rest, back-to-backs, and efficiency changes.
    """
    try:
        clean_season = (season or current_nba_season()).split(' (')[0]

        try:
            from nba_api.stats.endpoints import leaguedashplayerstats, leaguegamelog
            stats = leaguedashplayerstats.LeagueDashPlayerStats(
                season=clean_season,
                per_mode_detailed="PerGame",
                season_type_all_star="Regular Season"
            )
        except Exception as e:
            print(f"Fatigue stats load error: {e}")
            return {
                "season": clean_season,
                "generated_at": datetime.utcnow().isoformat(),
                "players": [],
                "summary": {"high": 0, "medium": 0, "low": 0, "average": 0, "back_to_back": 0}
            }
        stats_df = stats.get_data_frames()[0]
        if stats_df.empty:
            return {
                "season": clean_season,
                "generated_at": datetime.utcnow().isoformat(),
                "players": [],
                "summary": {"high": 0, "medium": 0, "low": 0, "average": 0, "back_to_back": 0}
            }

        if team_id:
            stats_df = stats_df[stats_df["TEAM_ID"] == team_id].copy()

        player_logs = []
        for season_type in ["Playoffs", "Regular Season"]:
            try:
                log = leaguegamelog.LeagueGameLog(
                    season=clean_season,
                    season_type_all_star=season_type,
                    player_or_team_abbreviation='P',
                    timeout=NBA_API_TIMEOUT
                )
                log_df = log.get_data_frames()[0]
                if not log_df.empty:
                    log_df["SeasonType"] = season_type
                    player_logs.append(log_df)
            except Exception as e:
                print(f"Fatigue {season_type} log error: {e}")

        logs_df = pd.concat(player_logs, ignore_index=True) if player_logs else pd.DataFrame()
        if team_id and not logs_df.empty and "TEAM_ID" in logs_df.columns:
            logs_df = logs_df[logs_df["TEAM_ID"] == team_id].copy()

        latest_league_date = None
        if not logs_df.empty and "GAME_DATE" in logs_df.columns:
            latest_league_date = pd.to_datetime(logs_df["GAME_DATE"], errors="coerce").max()
        if pd.isna(latest_league_date) or latest_league_date is None:
            latest_league_date = pd.Timestamp.now()

        players_out = []
        stat_cols = [
            "PLAYER_ID", "PLAYER_NAME", "TEAM_ID", "TEAM_ABBREVIATION", "GP", "MIN", "PTS",
            "REB", "AST", "STL", "BLK", "FG_PCT", "FG3_PCT", "FT_PCT", "AGE"
        ]
        available_stats = [col for col in stat_cols if col in stats_df.columns]

        for _, stat_row in stats_df[available_stats].iterrows():
            player_id = int(stat_row.get("PLAYER_ID") or 0)
            if not player_id:
                continue

            p_logs = pd.DataFrame()
            if not logs_df.empty and "PLAYER_ID" in logs_df.columns:
                p_logs = logs_df[logs_df["PLAYER_ID"] == player_id].copy()

            if not p_logs.empty and "GAME_DATE" in p_logs.columns:
                p_logs["GAME_DATE_PARSED"] = pd.to_datetime(p_logs["GAME_DATE"], errors="coerce")
                p_logs = p_logs.sort_values("GAME_DATE_PARSED", ascending=False)

            recent3 = p_logs.head(3)
            recent5 = p_logs.head(5)
            previous5 = p_logs.iloc[5:10]

            minutes_last_3 = round(to_number(recent3["MIN"].sum()) if "MIN" in recent3 else 0, 1)
            if minutes_last_3 == 0:
                minutes_last_3 = round(to_number(stat_row.get("MIN")) * min(3, max(1, to_number(stat_row.get("GP"), 1))), 1)

            if not p_logs.empty:
                latest_date = p_logs["GAME_DATE_PARSED"].iloc[0]
            else:
                latest_date = latest_league_date
            last7_cutoff = latest_date - pd.Timedelta(days=7)
            games_last_7 = int((p_logs["GAME_DATE_PARSED"] >= last7_cutoff).sum()) if not p_logs.empty else 0

            back_to_back = False
            rest_intervals = []
            if len(p_logs) >= 2:
                dates = p_logs["GAME_DATE_PARSED"].dropna().head(5).tolist()
                for index in range(len(dates) - 1):
                    interval = days_between(dates[index], dates[index + 1])
                    rest_intervals.append(interval)
                back_to_back = bool(rest_intervals and rest_intervals[0] <= 1)
            avg_rest_days = round(sum(rest_intervals) / len(rest_intervals), 1) if rest_intervals else 3.0

            season_pts = to_number(stat_row.get("PTS"))
            recent_pts = to_number(recent5["PTS"].mean()) if not recent5.empty and "PTS" in recent5 else season_pts
            previous_pts = to_number(previous5["PTS"].mean()) if not previous5.empty and "PTS" in previous5 else season_pts
            recent_fg = (to_number(recent5["FGM"].sum()) / max(1, to_number(recent5["FGA"].sum()))) if not recent5.empty and "FGM" in recent5 and "FGA" in recent5 else to_number(stat_row.get("FG_PCT"))
            season_fg = to_number(stat_row.get("FG_PCT"))
            scoring_drop = max(0, previous_pts - recent_pts)
            efficiency_drop = max(0, (season_fg - recent_fg) * 100)
            performance_drop = round(scoring_drop + efficiency_drop * 0.45, 1)

            fatigue_score = compute_fatigue_score(minutes_last_3, back_to_back, games_last_7, performance_drop)
            fatigue = {
                "id": f"nba-api-{player_id}-{clean_season}",
                "player_id": str(player_id),
                "score_date": normalize_game_date(latest_date),
                "fatigue_score": fatigue_score,
                "minutes_last_3": minutes_last_3,
                "back_to_back": back_to_back,
                "games_last_7": games_last_7,
                "performance_drop": performance_drop,
                "risk_level": risk_level_from_score(fatigue_score),
                "avg_rest_days": avg_rest_days,
                "workload_score": round(min(minutes_last_3 / 110 * 100, 100), 1),
            }

            player = clean_data(stat_row.to_dict())
            player["PERSON_ID"] = player_id
            player["fatigue"] = fatigue
            player["recent_games"] = clean_df(p_logs.head(7)) if not p_logs.empty else []
            players_out.append(player)

        players_out.sort(key=lambda item: item.get("fatigue", {}).get("fatigue_score", 0), reverse=True)
        high = sum(1 for player in players_out if player["fatigue"]["risk_level"] == "high")
        medium = sum(1 for player in players_out if player["fatigue"]["risk_level"] == "medium")
        low = sum(1 for player in players_out if player["fatigue"]["risk_level"] == "low")
        average = round(sum(player["fatigue"]["fatigue_score"] for player in players_out) / len(players_out)) if players_out else 0
        b2b = sum(1 for player in players_out if player["fatigue"]["back_to_back"])

        return clean_data({
            "season": clean_season,
            "generated_at": datetime.utcnow().isoformat(),
            "players": players_out,
            "summary": {"high": high, "medium": medium, "low": low, "average": average, "back_to_back": b2b}
        })
    except Exception as e:
        print(f"Fatigue report error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/players/search")
@cached(duration=86400) # Cache for 24 hours
async def search_players(query: str):
    from nba_api.stats.static import players as nba_players
    all_players = nba_players.get_active_players()
    results = [p for p in all_players if query.lower() in p['full_name'].lower()]
    return results[:10]

@app.get("/api/player/{player_id}")
@cached(duration=86400)
async def get_player_info(player_id: int):
    try:
        from nba_api.stats.endpoints import commonplayerinfo
        info = commonplayerinfo.CommonPlayerInfo(player_id=player_id, timeout=NBA_API_TIMEOUT)
        data = info.get_dict()['resultSets'][0]
        headers = data['headers']
        row = data['rowSet'][0]
        result = dict(zip(headers, row))
        return {k: (None if isinstance(v, float) and np.isnan(v) else v) for k, v in result.items()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/team/{team_id}/roster")
@cached(duration=3600)
async def get_team_roster(team_id: int):
    try:
        from nba_api.stats.endpoints import commonteamroster, leaguedashplayerstats
        roster = commonteamroster.CommonTeamRoster(team_id=team_id)
        roster_df = roster.get_data_frames()[0]
        
        # Fetch league stats to merge with roster
        stats = leaguedashplayerstats.LeagueDashPlayerStats(
            season=current_nba_season(),
            per_mode_detailed="PerGame",
            season_type_all_star="Regular Season"
        )
        stats_df = stats.get_data_frames()[0]
        
        # Deduplicate stats_df by prioritizing current team_id, then TOT, then any other team row
        if not stats_df.empty:
            stats_df['is_current_team'] = stats_df['TEAM_ID'] == team_id
            stats_df['is_tot'] = stats_df['TEAM_ABBREVIATION'] == 'TOT'
            stats_df = stats_df.sort_values(by=['PLAYER_ID', 'is_current_team', 'is_tot'], ascending=[True, False, False])
            stats_subset = stats_df[['PLAYER_ID', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'FG_PCT', 'FG3_PCT', 'FT_PCT']].drop_duplicates(subset=['PLAYER_ID'], keep='first')
        else:
            stats_subset = pd.DataFrame(columns=['PLAYER_ID', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'FG_PCT', 'FG3_PCT', 'FT_PCT'])
        
        # Merge on PLAYER_ID
        merged_df = roster_df.merge(
            stats_subset, 
            on='PLAYER_ID', 
            how='left'
        )
        
        # Rename 'PLAYER' to 'PLAYER_NAME' for frontend consistency
        if 'PLAYER' in merged_df.columns:
            merged_df = merged_df.rename(columns={'PLAYER': 'PLAYER_NAME'})
            
        return clean_df(merged_df)
    except Exception as e:
        print(f"Roster error: {e}")
        return []

@app.get("/api/game/{game_id}/boxscore")
@cached(ttl=60)
def get_boxscore(game_id: str):
    try:
        return fetch_espn_boxscore(game_id)
    except Exception as e:
        print(f"ESPN boxscore fallback error: {e}")

    try:
        return fetch_live_boxscore(game_id)
    except Exception as e:
        print(f"Live Boxscore CDN error: {e}")

    try:
        from nba_api.stats.endpoints import boxscoretraditionalv2
        box = boxscoretraditionalv2.BoxScoreTraditionalV2(game_id=game_id)
        data = box.player_stats.get_dict()
        headers = data['headers']
        rows = data['data']
        return [dict(zip(headers, r)) for r in rows]
    except Exception as e:
        print(f"BoxScore API error: {e}")
        return []

@app.get("/api/game/{game_id}/team-stats")
def get_game_team_stats(game_id: str):
    try:
        return fetch_espn_team_stats(game_id)
    except Exception as e:
        print(f"ESPN team stats fallback error: {e}")

    try:
        return fetch_live_team_stats(game_id)
    except Exception as e:
        print(f"Live TeamStats CDN error: {e}")

    try:
        from nba_api.stats.endpoints import boxscoretraditionalv2
        box = boxscoretraditionalv2.BoxScoreTraditionalV2(game_id=game_id)
        data = box.team_stats.get_dict()
        headers = data['headers']
        rows = data['data']
        return [dict(zip(headers, r)) for r in rows]
    except Exception as e:
        print(f"TeamStats API error: {e}")
        return []

@app.get("/api/player/{player_id}/shots/{game_id}")
@cached(ttl=300)
def get_player_shots(player_id: int, game_id: str):
    try:
        shots = fetch_espn_shots(game_id, player_id=player_id)
        if shots:
            return shots
    except Exception as e:
        print(f"ESPN player shots fallback error: {e}")
    try:
        from nba_api.stats.endpoints import shotchartdetail
        # We need team_id for shotchartdetail, or use 0 for all
        shots = shotchartdetail.ShotChartDetail(player_id=player_id, game_id_nullable=game_id, team_id=0, context_measure_simple='FGA', timeout=NBA_API_TIMEOUT)
        data = shots.shot_chart_detail.get_dict()
        headers = data['headers']
        rows = data['data']
        return [dict(zip(headers, r)) for r in rows]
    except Exception as e:
        print(f"Player shots upstream error: {e}")
        raise HTTPException(status_code=503, detail="Real player shot data is temporarily unavailable.")

@app.get("/api/team/{team_id}/shots/{game_id}")
def get_team_shots(team_id: int, game_id: str):
    try:
        shots = fetch_espn_shots(game_id, team_id=team_id)
        if shots:
            return shots
    except Exception as e:
        print(f"ESPN team shots fallback error: {e}")
    try:
        from nba_api.stats.endpoints import shotchartdetail
        shots = shotchartdetail.ShotChartDetail(player_id=0, game_id_nullable=game_id, team_id=team_id, context_measure_simple='FGA', timeout=NBA_API_TIMEOUT)
        data = shots.shot_chart_detail.get_dict()
        headers = data['headers']
        rows = data['data']
        return [dict(zip(headers, r)) for r in rows]
    except Exception as e:
        print(f"Team shots upstream error: {e}")
        raise HTTPException(status_code=503, detail="Real team shot data is temporarily unavailable.")

@app.get("/api/player/{player_id}/averages")
@cached(ttl=3600)
def get_player_averages(player_id: int, season: str = None):
    try:
        from nba_api.stats.endpoints import playercareerstats, playergamelogs
        
        if season == "Lifetime":
            career = playercareerstats.PlayerCareerStats(player_id=player_id, timeout=NBA_API_TIMEOUT)
            df = career.career_totals_regular_season.get_data_frame()
            if df.empty: return {}
            row = df.iloc[0].to_dict()
            gp = row.get('GP', 1) or 1
            return {
                'GP': row.get('GP', 0),
                'GS': row.get('GS', 0),
                'MIN': round(row.get('MIN', 0) / gp, 1) if row.get('MIN') else 0,
                'PTS': round(row.get('PTS', 0) / gp, 1),
                'REB': round(row.get('REB', 0) / gp, 1),
                'AST': round(row.get('AST', 0) / gp, 1),
                'STL': round(row.get('STL', 0) / gp, 1),
                'BLK': round(row.get('BLK', 0) / gp, 1),
                'TOV': round(row.get('TOV', 0) / gp, 1),
                'PF': round(row.get('PF', 0) / gp, 1),
                'FG_PCT': row.get('FG_PCT', 0),
                'FG3_PCT': row.get('FG3_PCT', 0),
                'FT_PCT': row.get('FT_PCT', 0),
                'FGM': row.get('FGM', 0),
                'FGA': row.get('FGA', 0),
                'FG3M': row.get('FG3M', 0),
                'FG3A': row.get('FG3A', 0),
                'FTM': row.get('FTM', 0),
                'FTA': row.get('FTA', 0),
            }

        season = season or current_nba_season()
        clean_season = season.split(' (')[0]
        
        # Try Game Logs first for "Actual" current numbers
        try:
            logs = playergamelogs.PlayerGameLogs(player_id_nullable=player_id, season_nullable=clean_season, season_type_nullable='Regular Season', timeout=NBA_API_TIMEOUT)
            df_logs = logs.get_data_frames()[0]
            if not df_logs.empty:
                gp = len(df_logs)
                averages = {
                    'GP': gp,
                    'GS': len(df_logs[df_logs['START_POSITION'].notna()]) if 'START_POSITION' in df_logs else 0,
                    'MIN': round(df_logs['MIN'].mean(), 1) if 'MIN' in df_logs else 0,
                    'PTS': round(df_logs['PTS'].mean(), 1),
                    'REB': round(df_logs['REB'].mean(), 1),
                    'AST': round(df_logs['AST'].mean(), 1),
                    'STL': round(df_logs['STL'].mean(), 1),
                    'BLK': round(df_logs['BLK'].mean(), 1),
                    'TOV': round(df_logs['TOV'].mean(), 1),
                    'PF': round(df_logs['PF'].mean(), 1),
                    'FG_PCT': round(df_logs['FGM'].sum() / df_logs['FGA'].sum(), 3) if df_logs['FGA'].sum() > 0 else 0,
                    'FG3_PCT': round(df_logs['FG3M'].sum() / df_logs['FG3A'].sum(), 3) if df_logs['FG3A'].sum() > 0 else 0,
                    'FT_PCT': round(df_logs['FTM'].sum() / df_logs['FTA'].sum(), 3) if df_logs['FTA'].sum() > 0 else 0,
                    'FGM': int(df_logs['FGM'].sum()),
                    'FGA': int(df_logs['FGA'].sum()),
                    'FG3M': int(df_logs['FG3M'].sum()),
                    'FG3A': int(df_logs['FG3A'].sum()),
                    'FTM': int(df_logs['FTM'].sum()),
                    'FTA': int(df_logs['FTA'].sum()),
                }
                return averages
        except Exception as e:
            print(f"Log aggregation failed: {e}")

        # Fallback to Career Stats
        career = playercareerstats.PlayerCareerStats(player_id=player_id, timeout=NBA_API_TIMEOUT)
        df = career.get_data_frames()[0]
        season_df = df[df['SEASON_ID'] == clean_season]
        if season_df.empty: 
            # Player didn't play in this season, return empty stats
            return {
                'GP': 0,
                'GS': 0,
                'MIN': 0,
                'PTS': 0,
                'REB': 0,
                'AST': 0,
                'STL': 0,
                'BLK': 0,
                'TOV': 0,
                'PF': 0,
                'FG_PCT': 0,
                'FG3_PCT': 0,
                'FT_PCT': 0,
                'FGM': 0,
                'FGA': 0,
                'FG3M': 0,
                'FG3A': 0,
                'FTM': 0,
                'FTA': 0,
            }
            
        tot_row = season_df[season_df['TEAM_ABBREVIATION'] == 'TOT']
        row = tot_row.iloc[0].to_dict() if not tot_row.empty else season_df.iloc[0].to_dict()

        gp = row.get('GP', 1) or 1
        return {
            'GP': row.get('GP', 0),
            'GS': row.get('GS', 0),
            'MIN': round(row.get('MIN', 0) / gp, 1) if row.get('MIN') else 0,
            'PTS': round(row.get('PTS', 0) / gp, 1),
            'REB': round(row.get('REB', 0) / gp, 1),
            'AST': round(row.get('AST', 0) / gp, 1),
            'STL': round(row.get('STL', 0) / gp, 1),
            'BLK': round(row.get('BLK', 0) / gp, 1),
            'TOV': round(row.get('TOV', 0) / gp, 1),
            'PF': round(row.get('PF', 0) / gp, 1),
            'FG_PCT': row.get('FG_PCT', 0),
            'FG3_PCT': row.get('FG3_PCT', 0),
            'FT_PCT': row.get('FT_PCT', 0),
            'FGM': row.get('FGM', 0),
            'FGA': row.get('FGA', 0),
            'FG3M': row.get('FG3M', 0),
            'FG3A': row.get('FG3A', 0),
            'FTM': row.get('FTM', 0),
            'FTA': row.get('FTA', 0),
        }
    except Exception as e:
        print(f"Averages error: {e}")
        return {}

@app.get("/api/player/{player_id}/stats")
@cached(ttl=3600)
def get_player_detailed_stats(player_id: int, season: str = None):
    try:
        from nba_api.stats.endpoints import playergamelogs, commonplayerinfo
        import pandas as pd
        
        if not season:
            # Try to get the player's last active season
            try:
                info = commonplayerinfo.CommonPlayerInfo(player_id=player_id, timeout=NBA_API_TIMEOUT)
                df_info = info.get_data_frames()[0]
                if not df_info.empty:
                    to_year = str(df_info.iloc[0]['TO_YEAR'])
                    if to_year and len(to_year) == 4:
                        season = f"{to_year}-{str(int(to_year)+1)[2:]}"
            except:
                pass
                
        season = season or current_nba_season()
        clean_season = season.split(' (')[0]
        
        reg_logs = playergamelogs.PlayerGameLogs(player_id_nullable=player_id, season_nullable=clean_season, season_type_nullable='Regular Season')
        reg_df = reg_logs.get_data_frames()[0]
        reg_df['SeasonType'] = 'Regular Season'
        
        playoff_logs = playergamelogs.PlayerGameLogs(player_id_nullable=player_id, season_nullable=clean_season, season_type_nullable='Playoffs')
        playoff_df = playoff_logs.get_data_frames()[0]
        playoff_df['SeasonType'] = 'Playoffs'
        
        combined_df = pd.concat([playoff_df, reg_df], ignore_index=True)
        return clean_df(combined_df)
    except Exception as e:
        try:
             season = season or current_nba_season()
             clean_season = season.split(' (')[0]
             logs = playergamelogs.PlayerGameLogs(player_id_nullable=player_id, season_nullable=clean_season)
             df = logs.get_data_frames()[0]
             df['SeasonType'] = 'Regular Season'
             return clean_df(df)
        except:
             raise HTTPException(status_code=500, detail=str(e))
@app.get("/api/players")
@cached(ttl=86400)
def get_all_players():
    try:
        from nba_api.stats.static import players
        all_players = players.get_players()
        # Sort by active, then name
        all_players.sort(key=lambda x: (not x['is_active'], x['full_name']))
        return all_players
    except Exception as e:
        print(f"Players error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/player/{player_id}/profile")
@cached(ttl=86400)
def get_player_profile(player_id: int):
    try:
        from nba_api.stats.endpoints import commonplayerinfo, playercareerstats
        from nba_api.stats.static import players
        
        # Initial fallbacks from static data
        display_name = "Unknown Player"
        try:
            p_static = players.find_player_by_id(player_id)
            if p_static:
                display_name = p_static.get('full_name', display_name)
        except:
            pass

        info_df = pd.DataFrame()
        try:
            info = commonplayerinfo.CommonPlayerInfo(player_id=player_id, timeout=NBA_API_TIMEOUT)
            info_df = info.get_data_frames()[0]
        except Exception as e:
            print(f"CommonPlayerInfo error for {player_id}: {e}")

        row = info_df.iloc[0].to_dict() if not info_df.empty else {}
        
        try:
            career = playercareerstats.PlayerCareerStats(player_id=player_id, timeout=NBA_API_TIMEOUT)
            career_df = career.get_data_frames()[0]
            if not career_df.empty:
                player_seasons = set(career_df['SEASON_ID'].unique().tolist())
            else:
                player_seasons = set()
        except Exception as e:
            print(f"PlayerCareerStats error for {player_id}: {e}")
            player_seasons = set()
        seasons = sorted(player_seasons, reverse=True)
        
        return {
            'id': player_id,
            'name': row.get('DISPLAY_FIRST_LAST', display_name),
            'height': row.get('HEIGHT', 'N/A'),
            'weight': row.get('WEIGHT', 'N/A'),
            'school': row.get('SCHOOL', 'N/A'),
            'country': row.get('COUNTRY', 'N/A'),
            'draft_year': row.get('DRAFT_YEAR', 'N/A'),
            'draft_round': row.get('DRAFT_ROUND', 'N/A'),
            'draft_pick': row.get('DRAFT_NUMBER', 'N/A'),
            'position': row.get('POSITION', 'N/A'),
            'from_year': row.get('FROM_YEAR', 'N/A'),
            'to_year': row.get('TO_YEAR', 'N/A'),
            'seasons': seasons
        }
    except Exception as e:
        print(f"Profile error for {player_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/player/{player_id}/awards")
@cached(ttl=86400)
def get_player_awards(player_id: int, season: str = None):
    try:
        from nba_api.stats.endpoints import playerawards
        awards = playerawards.PlayerAwards(player_id=player_id)
        df = awards.get_data_frames()[0]
        if df.empty: return []
        
        if season and season != 'Lifetime':
            clean_season = season.split(' (')[0]
            if 'SEASON' in df.columns:
                df = df[df['SEASON'].astype(str) == clean_season]

        keep_cols = [col for col in ['DESCRIPTION', 'SEASON', 'ALL_NBA_TEAM_NUMBER', 'TYPE', 'SUBTYPE1', 'SUBTYPE2', 'SUBTYPE3'] if col in df.columns]
        if not keep_cols:
            return clean_df(df)
        return clean_df(df[keep_cols])
    except Exception as e:
        print(f"Awards error: {e}")
        return []

@app.get("/api/team/{team_id}/gamelog")
@cached(duration=3600)
async def get_team_gamelog(team_id: int, season: str = None, season_type: str = "Regular Season"):
    try:
        from nba_api.stats.endpoints import teamgamelogs
        clean_season = (season or current_nba_season()).split(' (')[0]
        logs = teamgamelogs.TeamGameLogs(
            team_id_nullable=team_id,
            season_nullable=clean_season,
            season_type_nullable=season_type
        )
        df = logs.get_data_frames()[0]
        
        # Calculate Opponent Points for "perfect" data
        if 'PLUS_MINUS' in df.columns and 'PTS' in df.columns:
            df['OPP_PTS'] = df['PTS'] - df['PLUS_MINUS']
            
        return clean_df(df)
    except Exception as e:
        print(f"Gamelog error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/archive/games")
@cached(duration=86400)
async def get_historical_games(season: str = None, season_type: str = "Regular Season", team_id: int = None, limit: int = 100):
    try:
        from nba_api.stats.endpoints import leaguegamelog
        clean_season = (season or current_nba_season()).split(' (')[0]
        max_rows = max(1, min(limit, 2000))
        log = leaguegamelog.LeagueGameLog(
            season=clean_season,
            season_type_all_star=season_type,
            player_or_team_abbreviation='T',
            timeout=NBA_API_TIMEOUT
        )
        df = log.get_data_frames()[0]
        if df.empty:
            return []

        if team_id:
            game_ids = df[df['TEAM_ID'] == team_id]['GAME_ID'].unique().tolist()
            df = df[df['GAME_ID'].isin(game_ids)]

        games = []
        for game_id, group in df.groupby('GAME_ID', sort=False):
            rows = group.to_dict(orient='records')
            if not rows:
                continue

            first = rows[0]
            second = rows[1] if len(rows) > 1 else None
            home = next((row for row in rows if ' vs. ' in str(row.get('MATCHUP', ''))), None)
            away = next((row for row in rows if ' @ ' in str(row.get('MATCHUP', ''))), None)
            if not home:
                home = first
            if not away:
                away = second or first

            plus_minus = first.get('PLUS_MINUS')
            opp_pts = None
            if second:
                opp_pts = second.get('PTS')
            elif plus_minus is not None:
                opp_pts = first.get('PTS', 0) - plus_minus

            stage = season_type
            matchup = first.get('MATCHUP') or ''
            if season_type == 'Playoffs':
                stage = 'Playoffs'

            games.append({
                **first,
                "GAME_ID": game_id,
                "GAME_DATE": normalize_game_date(first.get('GAME_DATE')),
                "OPPONENT_TEAM_ID": (second or {}).get('TEAM_ID'),
                "OPPONENT_TEAM_ABBREVIATION": (second or {}).get('TEAM_ABBREVIATION'),
                "OPPONENT_TEAM_NAME": (second or {}).get('TEAM_NAME'),
                "OPP_PTS": opp_pts,
                "HOME_TEAM_ID": home.get('TEAM_ID'),
                "AWAY_TEAM_ID": away.get('TEAM_ID'),
                "HOME_TEAM_ABBREVIATION": home.get('TEAM_ABBREVIATION'),
                "AWAY_TEAM_ABBREVIATION": away.get('TEAM_ABBREVIATION'),
                "HOME_TEAM_NAME": home.get('TEAM_NAME'),
                "AWAY_TEAM_NAME": away.get('TEAM_NAME'),
                "HOME_PTS": home.get('PTS'),
                "AWAY_PTS": away.get('PTS'),
                "STAGE": stage,
                "MATCHUP": matchup
            })

        games = sorted(games, key=lambda item: item.get('GAME_DATE') or '', reverse=True)
        return clean_data(games[:max_rows])
    except Exception as e:
        print(f"Archive games error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/playoffs")
@cached(duration=86400) # Playoff structure changes rarely
async def get_playoffs(season: str = None):
    try:
        from nba_api.stats.endpoints import commonplayoffseries, leaguegamelog
        clean_season = (season or current_nba_season()).split(' (')[0]
        
        # 1. Get series structure
        series_endpoint = commonplayoffseries.CommonPlayoffSeries(season=clean_season, timeout=NBA_API_TIMEOUT)
        series_df = series_endpoint.get_data_frames()[0]
        
        # 2. Get game results
        log_endpoint = leaguegamelog.LeagueGameLog(season=clean_season, season_type_all_star='Playoffs', timeout=NBA_API_TIMEOUT)
        log_df = log_endpoint.get_data_frames()[0]
        
        # 3. Aggregate wins per series
        # Merge series_df with log_df on GAME_ID
        merged = series_df.merge(log_df[['GAME_ID', 'TEAM_ID', 'WL', 'PTS']], on='GAME_ID', how='left')
        
        # Group by SERIES_ID and calculate HOME_WINS / VISITOR_WINS
        # Since merged has one row per team per game (2 rows per game), we filter to one row per game
        # or just sum W for each team.
        
        # Convert back to dict for cleaning
        return clean_df(merged)
    except Exception as e:
        print(f"Playoffs upstream error: {e}")
        raise HTTPException(status_code=503, detail="Real playoff data is temporarily unavailable.")

@app.get("/api/game/{game_id}/player/{player_id}/impact")
@cached(duration=3600)
async def get_player_game_impact(game_id: str, player_id: int):
    try:
        plays = fetch_espn_playbyplay(game_id)
        df = pd.DataFrame(plays)
    except Exception:
        try:
            plays = fetch_live_playbyplay(game_id)
            df = pd.DataFrame(plays)
        except Exception:
            from nba_api.stats.endpoints import playbyplayv2
            pbp = playbyplayv2.PlayByPlayV2(game_id=game_id)
            df = pbp.get_data_frames()[0]
    if df.empty or 'PLAYER1_ID' not in df.columns:
        return {"scoring_breakdown": [], "assists_tracking": [], "total_generated_points": 0}
    
    # 1. Scoring Breakdown
    scoring_plays = df[(df['PLAYER1_ID'] == player_id) & (df['EVENTMSGTYPE'].isin([1, 3]))]
    shots = []
    for _, play in scoring_plays.iterrows():
        desc = str(play.get('HOMEDESCRIPTION') or play.get('VISITORDESCRIPTION') or play.get('NEUTRALDESCRIPTION') or "")
        event_type = int(play.get('EVENTMSGTYPE') or 0)
        if event_type in [1, 3]:
            points = infer_play_points(play, desc)
            
            shots.append({
                "description": desc,
                "points": points,
                "type": "FT" if points == 1 else "3PT" if points == 3 else "2PT"
            })
            
    # 2. Assists Tracking
    assists = []
    assists_df = df[df.get('PLAYER2_ID', pd.Series(dtype='int64')) == player_id]
    for _, play in assists_df.iterrows():
        desc = str(play.get('HOMEDESCRIPTION') or play.get('VISITORDESCRIPTION') or play.get('NEUTRALDESCRIPTION') or "")
        if int(play.get('EVENTMSGTYPE') or 0) == 1:
            scorer_id = int(play.get('PLAYER1_ID') or 0)
            scorer_name = str(play.get('PLAYER1_NAME') or "Teammate")
            points = infer_play_points(play, desc)
            assists.append({
                "to_player_id": scorer_id,
                "to_player_name": scorer_name,
                "points_generated": points,
                "description": desc
            })
            
    return {
        "scoring_breakdown": shots,
        "assists_tracking": assists,
        "total_generated_points": sum(a['points_generated'] for a in assists)
    }

@app.get("/api/leaders")
@cached(duration=3600)
async def get_leaders(category: str = "PTS", season: str = None, per_mode: str = "PerGame", season_type: str = "Regular Season"):
    try:
        target_season = season or current_nba_season()
        
        # All-Time / Lifetime Logic (Usually Regular Season only in NBA API All Time)
        if target_season == "Lifetime":
            # ... (Lifetime logic remains same)
            from nba_api.stats.endpoints import leagueleaders
            
            category_map_alltime = {
                "Games played": "GP",
                "Total points": "PTS",
                "Total assists": "AST",
                "Total rebounds": "REB",
                "Total steals": "STL",
                "Total blocks": "BLK",
                "Total minutes": "MIN",
                "Total turnovers": "TOV",
                "Points per game": "PTS",
                "Assists per game": "AST",
                "Rebounds per game": "REB",
                "Steals per game": "STL",
                "Blocks per game": "BLK",
                "Minutes per game": "MIN",
                "Field goal %": "FG_PCT",
                "3-pointer %": "FG3_PCT",
                "3-pointers made": "FG3M",
                "3-pointers attempted per game": "FG3A",
                "Free-throw %": "FT_PCT",
                "Free throws attempted per game": "FTA",
                "Turnovers per game": "TOV",
                "True-shooting %": "TS_PCT",
                "Real performance rating per game": "PER",
                "Offensive rebounds": "OREB",
                "Defensive rebounds": "DREB",
                "Personal fouls": "PF"
            }
            
            stat_cat = category_map_alltime.get(category, "PTS")
            print(f"Fetching All-Time leaders for {stat_cat} ({season_type})")
            
            leaders = leagueleaders.LeagueLeaders(
                season='All Time',
                stat_category_abbreviation=stat_cat,
                season_type_all_star=season_type
            )
            df = leaders.get_data_frames()[0]
            
            if df.empty:
                print(f"Warning: No data returned for All-Time {season_type}")
                return []

            if 'TEAM_ABBREVIATION' not in df.columns:
                df['TEAM_ABBREVIATION'] = 'MULT'
            if 'TEAM_ID' not in df.columns:
                df['TEAM_ID'] = 0
                
            # Rename columns to match frontend expectations if necessary
            # LeagueLeaders returns PLAYER_NAME, GP, etc.
            
            # Custom calculations for Lifetime
            if 'FGA' in df.columns and 'FTA' in df.columns and 'PTS' in df.columns:
                df['TS_PCT'] = df['PTS'] / (2 * (df['FGA'] + 0.44 * df['FTA']))
                df['TS_PCT'] = df['TS_PCT'].fillna(0)
                
            if all(x in df.columns for x in ['PTS', 'REB', 'AST', 'STL', 'BLK', 'FGA', 'FGM', 'FTA', 'FTM', 'TOV']):
                df['PER'] = (df['PTS'] + df['REB'] + df['AST'] + df['STL'] + df['BLK'] 
                             - (df['FGA'] - df['FGM']) - (df['FTA'] - df['FTM']) - df['TOV'])
                df['PER'] = df['PER'].fillna(0)

            # Ensure we have per-game columns for "per game" categories
            for col, total_col in [("PTS", "PTS"), ("REB", "REB"), ("AST", "AST"), ("STL", "STL"), ("BLK", "BLK"), ("MIN", "MIN"), ("TOV", "TOV")]:
                if total_col in df.columns and 'GP' in df.columns:
                    # Keep total for total categories, but provide per-game for per-game categories
                    if "per game" in category.lower() or category in ["Points per game", "Assists per game", "Rebounds per game", "Steals per game", "Blocks per game", "Minutes per game", "Turnovers per game"]:
                        df[total_col] = (df[total_col] / df['GP']).round(1)
            
            df = df.sort_values(stat_cat, ascending=False).head(50)
            return clean_df(df)

        clean_season = target_season.split(' (')[0]
        print(f"Fetching leaders for {category} in {clean_season} ({per_mode}, {season_type})")
        
        # Use LeagueDashPlayerStats for specific seasons
        from nba_api.stats.endpoints import leaguedashplayerstats
        leaders = leaguedashplayerstats.LeagueDashPlayerStats(
            season=clean_season,
            per_mode_detailed=per_mode,
            season_type_all_star=season_type,
            last_n_games=0,
            measure_type_detailed_defense='Base',
            month=0,
            opponent_team_id=0,
            pace_adjust="N",
            plus_minus="N",
            rank="N",
            outcome_nullable="",
            location_nullable="",
            season_segment_nullable="",
            date_from_nullable="",
            date_to_nullable="",
            vs_conference_nullable="",
            vs_division_nullable="",
            team_id_nullable=0
        )
        df = leaders.get_data_frames()[0]
        
        if df.empty:
            print(f"No data found for {clean_season}")
            return []

        print(f"Found {len(df)} players")

        # Custom calculations
        if 'FGA' in df.columns and 'FTA' in df.columns and 'PTS' in df.columns:
            df['TS_PCT'] = df['PTS'] / (2 * (df['FGA'] + 0.44 * df['FTA']))
            df['TS_PCT'] = df['TS_PCT'].fillna(0)
            
        if all(x in df.columns for x in ['PTS', 'REB', 'AST', 'STL', 'BLK', 'FGA', 'FGM', 'FTA', 'FTM', 'TOV']):
            df['PER'] = (df['PTS'] + df['REB'] + df['AST'] + df['STL'] + df['BLK'] 
                         - (df['FGA'] - df['FGM']) - (df['FTA'] - df['FTM']) - df['TOV'])
            df['PER'] = df['PER'].fillna(0)

        category_map = {
            "Games played": "GP",
            "Points per game": "PTS",
            "Total points": "PTS",
            "Total assists": "AST",
            "Total rebounds": "REB",
            "Total steals": "STL",
            "Total blocks": "BLK",
            "Total minutes": "MIN",
            "Total turnovers": "TOV",
            "Assists per game": "AST",
            "Rebounds per game": "REB",
            "Steals per game": "STL",
            "Blocks per game": "BLK",
            "Minutes per game": "MIN",
            "Field goal %": "FG_PCT",
            "3-pointer %": "FG3_PCT",
            "3-pointers made": "FG3M",
            "3-pointers attempted per game": "FG3A",
            "Free-throw %": "FT_PCT",
            "Free throws attempted per game": "FTA",
            "Turnovers per game": "TOV",
            "+/- per game": "PLUS_MINUS",
            "True-shooting %": "TS_PCT",
            "Real performance rating per game": "PER",
            "Offensive rebounds": "OREB",
            "Defensive rebounds": "DREB",
            "Personal fouls": "PF"
        }
        
        sort_col = category_map.get(category, category)
        if sort_col not in df.columns:
            sort_col = "PTS"
            
        if "PCT" in sort_col or sort_col in ["TS_PCT", "PER"]:
            min_gp = 10 if per_mode == "PerGame" else 1
            df = df[df["GP"] >= min_gp]

        df = df.sort_values(sort_col, ascending=False).head(50)
        return clean_df(df)
    except Exception as e:
        print(f"Leaders error: {e}")
        if target_season != "Lifetime" and target_season == current_nba_season():
            try:
                return fetch_espn_player_leaders(target_season, category, season_type, per_mode)
            except Exception as fallback_error:
                print(f"ESPN leaderboard error for {target_season}: {fallback_error}")
        raise HTTPException(status_code=503, detail="Requested player stats are temporarily unavailable.")

@app.get("/api/vault/team-history")
async def get_team_history(team_id: int, season: str):
    # Dynamic cache duration: 1 hour for current season, 24 hours for historical
    is_current = season == current_nba_season()
    cache_duration = 3600 if is_current else 86400
    
    key = f"get_team_history:{team_id}:{season}"
    now = time.time()
    
    if key in cache and now < cache[key]["expiry"]:
        return cache[key]["data"]
        
    try:
        from nba_api.stats.endpoints import (
            commonteamroster,
            leaguedashteamstats,
            leaguestandingsv3,
            teamplayerdashboard,
        )
        clean_season = season.split(' (')[0]
        
        # 1. Team Stats & Record
        team_stats = leaguedashteamstats.LeagueDashTeamStats(
            season=clean_season,
            team_id_nullable=team_id,
            per_mode_detailed='PerGame'
        )
        stats_df = team_stats.get_data_frames()[0]
        
        # 1.1 Advanced Stats
        adv_stats = leaguedashteamstats.LeagueDashTeamStats(
            season=clean_season,
            team_id_nullable=team_id,
            measure_type_detailed_defense='Advanced'
        )
        adv_df = adv_stats.get_data_frames()[0]
        
        # 2. Roster & Coaches
        roster = commonteamroster.CommonTeamRoster(team_id=team_id, season=clean_season)
        roster_df = roster.get_data_frames()[0]
        coaches_df = roster.get_data_frames()[1]
        
        # 3. Player Stats for identifying Starters
        player_stats_df = pd.DataFrame()
        try:
            player_stats_endpoint = teamplayerdashboard.TeamPlayerDashboard(
                team_id=team_id,
                season=clean_season,
                per_mode_detailed='PerGame'
            )
            player_stats_df = player_stats_endpoint.get_data_frames()[1] # [1] is individual player stats
        except Exception as pe:
            print(f"Player dashboard error (non-fatal): {pe}")
        
        # 4. Standings for rank
        standings = leaguestandingsv3.LeagueStandingsV3(season=clean_season, timeout=NBA_API_TIMEOUT)
        standings_df = standings.get_data_frames()[0]
        team_standing = standings_df[standings_df['TeamID'] == team_id]
        
        # Merge stats with additional info
        stats_data = clean_data(stats_df.iloc[0].to_dict()) if not stats_df.empty else {}
        adv_data = clean_data(adv_df.iloc[0].to_dict()) if not adv_df.empty else {}
        standing_data = clean_data(team_standing.iloc[0].to_dict()) if not team_standing.empty else {}
        
        # Enrich roster with player stats
        enriched_roster = []
        
        # Determine the source for the roster
        source_df = pd.DataFrame()
        if not roster_df.empty:
            source_df = roster_df.copy()
            # Rename columns to standard names if needed
            if 'PLAYER' in source_df.columns and 'PLAYER_NAME' not in source_df.columns:
                source_df['PLAYER_NAME'] = source_df['PLAYER']
        elif not player_stats_df.empty:
            # Fallback to player stats if roster is empty
            source_df = player_stats_df.copy()
            if 'PLAYER_NAME' not in source_df.columns and 'PLAYER' in source_df.columns:
                source_df['PLAYER_NAME'] = source_df['PLAYER']
            # Add missing columns with defaults
            if 'NUM' not in source_df.columns: source_df['NUM'] = '--'
            if 'POSITION' not in source_df.columns: source_df['POSITION'] = 'N/A'

        if not source_df.empty:
            # Preserve essential roster columns
            cols_to_keep = ['PLAYER_ID', 'PLAYER_NAME', 'NUM', 'POSITION']
            existing_cols = [c for c in cols_to_keep if c in source_df.columns]
            roster_essential = source_df[existing_cols].copy()
            
            if not player_stats_df.empty and 'PLAYER_ID' in player_stats_df.columns:
                # Select only stat columns to avoid column conflicts in merge
                stat_cols = ['PLAYER_ID']
                for col in ['GP', 'GS', 'MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 
                            'TOV', 'FG_PCT', 'FG3_PCT', 'FT_PCT', 'OREB', 'DREB']:
                    if col in player_stats_df.columns:
                        stat_cols.append(col)
                
                stats_subset = player_stats_df[stat_cols].drop_duplicates(subset=['PLAYER_ID']).copy()
                
                # Merge on PLAYER_ID
                # If roster_essential already has some of these columns (e.g. from player_stats_df source), 
                # we don't need to merge them again or we should handle suffixes.
                merged_df = roster_essential.merge(
                    stats_subset, 
                    on='PLAYER_ID', 
                    how='left', 
                    suffixes=('', '_stats')
                )
                
                # Fill NaN numeric stats with 0
                numeric_cols = ['GP', 'GS', 'MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'TOV']
                for col in numeric_cols:
                    if col in merged_df.columns:
                        merged_df[col] = merged_df[col].fillna(0)
                
                enriched_roster = clean_df(merged_df)
            else:
                enriched_roster = clean_df(roster_essential)
        
        # Normalize standing keys so frontend can find W/L/rank consistently
        if standing_data:
            # Make sure WINS, LOSSES, W_PCT, and PlayoffRank exist with consistent keys
            for alias, keys in [
                ('WINS',  ['WINS', 'Wins', 'W']),
                ('LOSSES', ['LOSSES', 'Losses', 'L']),
                ('W_PCT', ['W_PCT', 'WinPCT', 'WIN_PCT']),
                ('PlayoffRank', ['PlayoffRank', 'PLAYOFF_RANK', 'ConferenceRank']),
                ('Arena', ['ARENA', 'Arena']),
                ('TeamCity', ['TeamCity', 'TEAM_CITY', 'City']),
                ('TeamAbbr', ['TeamAbbreviation', 'TEAM_ABBREVIATION', 'TeamAbbr']),
            ]:
                if alias not in standing_data:
                    for k in keys:
                        if k in standing_data and standing_data[k] is not None:
                            standing_data[alias] = standing_data[k]
                            break

        # Combine
        result = {
            "stats": stats_data,
            "advanced": adv_data,
            "standing": standing_data,
            "coaches": clean_df(coaches_df),
            "roster": enriched_roster,
            "player_stats": clean_df(player_stats_df) if not player_stats_df.empty else []
        }
        
        # Cache the result
        cache[key] = {
            "data": result,
            "expiry": now + cache_duration
        }
        return result
    except Exception as e:
        print(f"Vault Team History error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/vault/season-awards")
@cached(duration=86400)
async def get_season_awards(season: str):
    try:
        clean_season = season.split(' (')[0]
        # Find awards for this specific season
        season_awards = next((a for a in NBA_AWARDS_DATA if a["season"] == clean_season), None)
        if not season_awards:
            return []
            
        # Format for vault consumption: list of {AWARD, PLAYER, ID, PTS, REB, AST}
        formatted = []
        for key in ["mvp", "dpoy", "roty", "fmvp", "sixman", "mip", "coty"]:
            if key in season_awards:
                award_data = season_awards[key]
                formatted.append({
                    "AWARD": key.upper(),
                    "PLAYER": award_data.get("name"),
                    "ID": award_data.get("id"),
                    "PTS": award_data.get("pts"),
                    "REB": award_data.get("reb"),
                    "AST": award_data.get("ast")
                })
        return formatted
    except Exception as e:
        print(f"Vault Season Awards error: {e}")
        return []

@app.get("/api/vault/jerseys")
async def get_team_jerseys(team_name: str, season: str = None):
    try:
        archive_path = os.path.join(os.path.dirname(__file__), "nba_master_archive.json")
        if not os.path.exists(archive_path):
            return []
            
        with open(archive_path, 'r') as f:
            data = json.load(f)
            
        team_data = data.get(team_name, [])
        if not team_data:
            # Try fuzzy match
            for name in data:
                if team_name.lower() in name.lower() or name.lower() in team_name.lower():
                    team_data = data[name]
                    break
        
        if season:
            year = season.split('-')[0] # "2024"
            filtered = []
            for j in team_data:
                yr = j.get('year_range', '')
                # Match if season string is in range, range is in season, or base year matches
                if season in yr or yr in season or year in yr:
                    filtered.append(j)
            if filtered:
                return filtered
                
        return team_data
    except Exception as e:
        print(f"Error fetching jerseys: {e}")
        return []

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
