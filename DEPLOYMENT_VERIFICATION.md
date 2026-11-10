# Deployment Verification Guide

## Changes Deployed (Commit: 5f52126 and 4aa192d)

### Critical Fixes Applied:

1. **Playoffs API Fix**: Returns empty array instead of 503 error when playoffs haven't started
2. **Dual Season Strategy**: 
   - Live/Current Data (2026-27): standings, players, leaders, games
   - Complete Historical Data (2025-26): playoffs, awards, vault
3. **Backend Functions**:
   - `current_nba_season()` - Returns actual current season (2026-27)
   - `get_available_season()` - Returns completed season for historical data (2025-26)
   - `get_default_season_for_live_data()` - Returns current season for live endpoints
4. **Frontend Functions**:
   - `getCurrentNbaSeason()` - Returns 2026-27
   - `getCompletedNbaSeason()` - Returns 2025-26

## Deployment Status

### Automatic Deployment
Your services should auto-deploy from GitHub:
- **Render (Backend)**: Deploys from main branch automatically
- **Vercel (Frontend)**: Deploys from main branch automatically

Check deployment status:
- Render: https://dashboard.render.com/
- Vercel: https://vercel.com/dashboard

## Manual Verification Steps

### 1. Check Backend Health
```powershell
Invoke-RestMethod -Uri "https://basketball-hub-api-pesl.onrender.com/api/health"
```
Expected: `{ status: "ok" }`

### 2. Test Standings (Should show current 2026-27 season)
```powershell
$standings = Invoke-RestMethod -Uri "https://basketball-hub-api-pesl.onrender.com/api/standings"
$standings.Count  # Should return 30 teams
$standings[0]     # Check data structure
```
Expected: 30 teams with current season standings

### 3. Test Players (Should show current 2026-27 season)
```powershell
$players = Invoke-RestMethod -Uri "https://basketball-hub-api-pesl.onrender.com/api/players/top"
$players.Count   # Should return ~50 players
$players[0]      # Check top player
```
Expected: Current season player stats

### 4. Test Playoffs (Should return 2025-26 or empty for 2026-27)
```powershell
$playoffs = Invoke-RestMethod -Uri "https://basketball-hub-api-pesl.onrender.com/api/playoffs"
$playoffs.Count   # May be 0 (no playoffs yet) or historical data
```
Expected: Either empty array [] or 2025-26 playoff data (NOT a 503 error)

### 5. Test Leaders
```powershell
$leaders = Invoke-RestMethod -Uri "https://basketball-hub-api-pesl.onrender.com/api/leaders?category=PTS"
$leaders.Count
$leaders[0]
```
Expected: Current season leaders

### 6. Test Scoreboard
```powershell
$scoreboard = Invoke-RestMethod -Uri "https://basketball-hub-api-pesl.onrender.com/api/scoreboard"
$scoreboard.Count
```
Expected: Today's games (may be 0 if no games today)

## Expected Behavior Per Page

| Page | Data Source | Season | Expected Result |
|------|-------------|--------|-----------------|
| Dashboard | Live API | 2026-27 | Current standings, today's games |
| Standings | Live API | 2026-27 (default) | Current standings, playoff bracket for 2025-26 |
| Leaderboard | Live API | 2026-27 | Current season leaders |
| Player Analyzer | Live API | 2026-27 (default) | Current season player stats |
| Awards | Static | Historical | All historical awards |
| Season Vault | Mixed | User selected | Historical team data |
| Playoffs (on Standings) | Historical | 2025-26 | Last completed playoffs |
| Dream Team | Live API | 2026-27 | Current season player pool |

## Troubleshooting

### If Backend Shows Old Code
1. Check Render dashboard for deployment status
2. Look for build errors in Render logs
3. If needed, manually trigger redeploy:
   - Go to Render Dashboard
   - Select `basketball-hub-api` service
   - Click "Manual Deploy" → "Deploy latest commit"

### If Frontend Shows Old Code
1. Check Vercel dashboard for deployment status  
2. If needed, clear Vercel cache and redeploy:
   ```bash
   cd frontend
   vercel --prod
   ```

### If Data Appears Stale
The backend has caching:
- Standings: 1 hour cache
- Players: 1 hour cache
- Playoffs: 24 hour cache
- Awards: 24 hour cache

Wait for cache to expire, or clear the `api_cache.json` file on the server.

### If 503 Errors Still Occur
Check these common causes:
1. **NBA Stats API Down**: ESPN fallback should handle this
2. **Timeout Issues**: Increase NBA_API_TIMEOUT environment variable
3. **Rate Limiting**: Wait a few minutes and retry

## Cache Management

The backend uses `api_cache.json` for persistence. If you need to clear it:

```python
# On the server or in main.py temporarily:
import os
if os.path.exists("api_cache.json"):
    os.remove("api_cache.json")
```

## Environment Variables

Ensure these are set in Render:
- `PORT`: Set by Render automatically
- `NBA_API_TIMEOUT`: Optional, defaults to 20 seconds

Ensure these are set in Vercel (frontend):
- `VITE_API_BASE_URL`: Should be empty to use proxy configuration

## Testing in Browser

1. Open your deployed frontend URL
2. Open Browser DevTools (F12)
3. Go to Network tab
4. Navigate to different pages
5. Check:
   - All API calls return 200 (success) or gracefully handled errors
   - No 503 errors on playoffs endpoint
   - Data loads properly
   - No infinite loading spinners

## Success Criteria

✅ All pages load without errors
✅ Standings show current 2026-27 season data
✅ Players show current season stats
✅ Playoffs show 2025-26 data or empty (no 503 error)
✅ Awards page loads historical data
✅ Scoreboard shows today's games
✅ No console errors in browser
✅ All API endpoints respond within 30 seconds

## Rollback Plan

If issues persist, revert to previous commit:
```bash
git revert HEAD
git push origin main
```

## Support

If you encounter issues not covered here:
1. Check Render logs for backend errors
2. Check Vercel deployment logs
3. Check browser console for frontend errors
4. Verify API responses match expected format
