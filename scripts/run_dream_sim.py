import requests
import random
import math
import sys

API = "http://127.0.0.1:8000"

POSITIONS = ['PG','SG','SF','PF','C']

def get(url):
    r = requests.get(url, timeout=10)
    r.raise_for_status()
    return r.json()

def prime_from_avg(avg, season='Prime'):
    if not avg or (avg.get('GP') or 0) <= 0:
        return None
    return {
        'season': season,
        'gp': int(avg.get('GP',0)),
        'min': float(avg.get('MIN',0)),
        'pts': float(avg.get('PTS',0)),
        'reb': float(avg.get('REB',0)),
        'ast': float(avg.get('AST',0)),
        'stl': float(avg.get('STL',0)),
        'blk': float(avg.get('BLK',0)),
        'tov': float(avg.get('TOV',0)),
        'fgPct': float(avg.get('FG_PCT') or 0),
        'fg3Pct': float(avg.get('FG3_PCT') or 0),
        'ftPct': float(avg.get('FT_PCT') or 0)
    }

def prime_score(s):
    return s['pts'] + s['reb']*0.8 + s['ast']*0.9 + s['stl']*2.3 + s['blk']*2.1 - s['tov']*0.6 + s['min']*0.12

def round_n(v, d=1):
    f = 10**d
    return math.floor(v*f+0.5)/f

def rate_team(players):
    offense = clamp(round(sum(p['prime']['pts'] + p['prime']['ast']*1.4 for p in players)*1.2),0,100)
    defense = clamp(round(sum(p['prime']['reb']*0.8 + p['prime']['stl']*3 + p['prime']['blk']*3.2 for p in players)*1.35),0,100)
    spacing = sum(p['prime']['fg3Pct'] for p in players)/max(len(players),1)
    balance = 15 if len(players)==5 else len(players)*2
    fit = clamp(round(balance + spacing*95 + sum(min(p['prime']['ast'],8) for p in players)*1.2),0,100)
    overall = round((offense*0.44 + defense*0.36 + fit*0.2))
    return {'offense':offense,'defense':defense,'fit':fit,'overall':overall}

def clamp(v, a, b):
    return max(a, min(b, v))

def random_between(a,b):
    return a + random.random()*(b-a)

def simulate_lines(players, own, opp, pace):
    usage_total = sum(p['prime']['pts'] + p['prime']['ast']*0.8 for p in players) or 1
    lines = []
    for p in players:
        usage = (p['prime']['pts'] + p['prime']['ast']*0.8)/usage_total
        defenseTax = 1 - max(-0.1, min(0.12, (opp['defense']-own['offense'])/600))
        pts = max(4, round((p['prime']['pts'] * (0.88 + usage) * defenseTax * pace) / 100 + random_between(-4,5)))
        reb = max(1, round(p['prime']['reb'] * random_between(0.78,1.22)))
        ast = max(0, round(p['prime']['ast'] * random_between(0.75,1.25)))
        stl = max(0, round(p['prime']['stl'] * random_between(0.55,1.55)))
        blk = max(0, round(p['prime']['blk'] * random_between(0.55,1.55)))
        tov = max(0, round(p['prime']['tov'] * random_between(0.65,1.4)))
        fgPct = clamp(p['prime']['fgPct'] + random_between(-0.045,0.045), 0.34, 0.66)
        fga = max(5, round(pts / max(0.75, fgPct*2) + random_between(0,5)))
        fgm = clamp(round(fga * fgPct), 1, fga)
        fg3a = max(0, round((5 if p['position']=='C' else 10) * random_between(0.7,1.25)))
        fg3m = clamp(round(fg3a * clamp(p['prime']['fg3Pct'] + random_between(-0.05,0.05), 0.22,0.48)), 0, fg3a)
        fta = max(0, round(pts * random_between(0.16,0.34)))
        ftm = clamp(round(fta * clamp(p['prime']['ftPct'] + random_between(-0.04,0.04),0.55,0.94)), 0, fta)
        lines.append({
            'player': p,
            'min': round(clamp(p['prime']['min'] + random_between(-3,3),28,42)),
            'pts': pts,
            'reb': reb,
            'ast': ast,
            'stl': stl,
            'blk': blk,
            'tov': tov,
            'fgm': fgm,
            'fga': fga,
            'fg3m': fg3m,
            'fg3a': fg3a,
            'ftm': ftm,
            'fta': fta,
            'plusMinus': 0
        })
    return lines

def scale_points(lines, target):
    current = sum(l['pts'] for l in lines) or 1
    remaining = target
    for i,l in enumerate(lines):
        if i == len(lines)-1:
            l['pts'] = max(0, remaining)
        else:
            l['pts'] = max(0, round(l['pts']*target/current))
            remaining -= l['pts']

def build_notes(teamA, teamB, ratingA, ratingB):
    allp = teamA+teamB
    scorer = max(allp, key=lambda x: x['pts']) if allp else None
    passer = max(allp, key=lambda x: x['ast']) if allp else None
    glass = max(allp, key=lambda x: x['reb']) if allp else None
    return [
        f"{scorer['player']['name']} leads all scorers with {scorer['pts']}." if scorer else 'Close scoring distribution.',
        f"{passer['player']['name']} controls creation with {passer['ast']} assists." if passer else 'Balanced playmaking setup.',
        f"{glass['player']['name']} owns the glass with {glass['reb']} rebounds." if glass else 'Shared rebounding effort.',
        'Team A has the stronger defensive profile.' if ratingA['defense']>ratingB['defense'] else 'Team B has the stronger defensive profile.'
    ]


def simulate(rosters):
    playersA = rosters['A']
    playersB = rosters['B']
    ratingA = rate_team(playersA)
    ratingB = rate_team(playersB)
    pace = round(96 + random.random()*8)
    linesA = simulate_lines(playersA, ratingA, ratingB, pace)
    linesB = simulate_lines(playersB, ratingB, ratingA, pace)
    rawA = sum(l['pts'] for l in linesA)
    rawB = sum(l['pts'] for l in linesB)
    targetA = max(82, round(rawA + (ratingA['overall']-ratingB['overall'])*0.18 + random_between(-5,7)))
    targetB = max(82, round(rawB + (ratingB['overall']-ratingA['overall'])*0.18 + random_between(-5,7)))
    scale_points(linesA, targetA)
    scale_points(linesB, targetB)
    scoreA = sum(l['pts'] for l in linesA)
    scoreB = sum(l['pts'] for l in linesB)
    for l in linesA:
        l['plusMinus'] = scoreA-scoreB + round(random_between(-6,6))
    for l in linesB:
        l['plusMinus'] = scoreB-scoreA + round(random_between(-6,6))
    winner = 'OT' if scoreA==scoreB else ('A' if scoreA>scoreB else 'B')
    return {
        'scoreA': scoreA,
        'scoreB': scoreB,
        'winner': winner,
        'pace': pace,
        'teamA': linesA,
        'teamB': linesB,
        'notes': build_notes(linesA, linesB, ratingA, ratingB)
    }


if __name__ == '__main__':
    # Fetch all rosters
    teams_rosters = get(f"{API}/api/teams/rosters")
    if not teams_rosters:
        print('No rosters available')
        sys.exit(1)
    team_ids = list(teams_rosters.keys())
    teamA_id = team_ids[0]
    teamB_id = team_ids[1] if len(team_ids)>1 else team_ids[0]
    rosterA = teams_rosters[teamA_id]
    rosterB = teams_rosters[teamB_id]

    def pick_top5(roster):
        # roster entries contain PLAYER_ID and PTS
        sorted_r = sorted([r for r in roster if r.get('PLAYER_ID')], key=lambda x: float(x.get('PTS') or 0), reverse=True)
        return sorted_r[:5]

    picksA = pick_top5(rosterA)
    picksB = pick_top5(rosterB)

    def build_team(picks):
        team = []
        for p in picks:
            pid = p.get('PLAYER_ID')
            profile = get(f"{API}/api/player/{pid}/profile")
            avg = None
            try:
                avg = get(f"{API}/api/player/{pid}/averages")
            except:
                avg = None
            prime = prime_from_avg(avg) if avg else {
                'season':'Prime','gp':int(p.get('GP') or 0),'min':float(p.get('MIN') or 34),'pts':float(p.get('PTS') or 10),'reb':float(p.get('REB') or 4),'ast':float(p.get('AST') or 2),'stl':float(p.get('STL') or 0.5),'blk':float(p.get('BLK') or 0.3),'tov':float(p.get('TOV') or 1.2),'fgPct':float(p.get('FG_PCT') or 0.45),'fg3Pct':float(p.get('FG3_PCT') or 0.33),'ftPct':float(p.get('FT_PCT') or 0.78)
            }
            position = profile.get('position') if profile else 'SG'
            team.append({'id':pid,'name':profile.get('name') if profile else p.get('PLAYER_NAME'),'position':position,'prime':prime})
        return team

    teamA = build_team(picksA)
    teamB = build_team(picksB)

    result = simulate({'A':teamA,'B':teamB})
    import json
    print(json.dumps({'teamA_id':teamA_id,'teamB_id':teamB_id,'result':result}, indent=2))
