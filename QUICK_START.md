# Quick Start Guide

## What Was Fixed

1. **✅ Letter Spacing** - Text is now easier to read across the entire website
2. **✅ 2026 Draft Players** - All 60 picks from the 2026 NBA Draft are now searchable
3. **✅ Deployment Configuration** - Proper setup for both local and production environments

## Local Development (Right Now)

### Start Backend
```bash
cd backend
uvicorn main:app --reload
```
Backend runs at: http://127.0.0.1:8000

### Start Frontend
```bash
cd frontend
npm run dev
```
Frontend runs at: http://127.0.0.1:5173

**Important**: Make sure `frontend/.env.local` exists with:
```
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

## Test Your Changes

### 1. Test Letter Spacing
- Open any page
- Text should be easier to read
- Check player names, stats, descriptions

### 2. Test 2026 Draft Players
- Go to "Player Analyzer" page
- Search for: **"AJ Dybantsa"** or **"Cameron Boozer"**
- They should appear in results

### 3. Test All Players
```bash
# In a new terminal
curl http://127.0.0.1:8000/api/players | python -m json.tool | grep -i dybantsa
```

## Deploy to Production

### Step 1: Verify Configuration
Check `frontend/.env` - it should look like this:
```bash
# Production: Leave empty to use Vercel proxy configuration (see vercel.json)
# The proxy will forward /api requests to your backend

# Local Development: Copy this file to .env.local and uncomment:
# VITE_API_BASE_URL=http://127.0.0.1:8000/api

# Custom Backend: Set to your deployed backend URL:
# VITE_API_BASE_URL=https://basketball-hub-api-95yz.onrender.com/api
```

**DO NOT** have `VITE_API_BASE_URL=http://127.0.0.1:8000/api` in `.env`

### Step 2: Commit and Push
```bash
git add .
git commit -m "Fix: Improve letter spacing, add 2026 draft class, fix deployment config"
git push origin main
```

### Step 3: Wait for Deployment
- **Vercel**: Deploys automatically from GitHub (2-3 minutes)
- **Render**: Deploys automatically from GitHub (3-5 minutes)

### Step 4: Test Deployed Site
1. Go to your Vercel URL
2. Open browser console (F12)
3. Check for errors
4. Test Player Analyzer with 2026 draft players
5. Verify text readability

## Troubleshooting

### "API backend is not configured"
- Check `frontend/.env` - should NOT have localhost URL
- Redeploy frontend on Vercel

### CORS Errors in Production
- Verify `vercel.json` has correct backend URL
- Backend URL should be: `https://basketball-hub-api-95yz.onrender.com/api`

### Backend Takes Forever to Load
- Free Render services sleep after 15 minutes
- First request takes 30-60 seconds to wake up
- Subsequent requests are fast

### 2026 Players Not Showing
- Check backend logs on Render
- Verify backend redeployed with new code
- Try: `curl https://basketball-hub-api-95yz.onrender.com/api/health`

## Files Changed

### Modified
- `backend/main.py` - Added 2026 draft class data
- `frontend/src/index.css` - Improved letter spacing
- `frontend/.env` - Removed localhost URL
- `frontend/.env.example` - Updated instructions

### Created
- `frontend/.env.local` - Local development configuration
- `DEPLOYMENT_GUIDE.md` - Comprehensive deployment guide
- `QUICK_START.md` - This file

## 2026 Draft Class (Top 10)

1. **AJ Dybantsa** - Washington Wizards
2. **Darryn Peterson** - Utah Jazz
3. **Cameron Boozer** - Memphis Grizzlies
4. **Caleb Wilson** - Chicago Bulls
5. **Keaton Wagler** - LA Clippers
6. **Mikel Brown Jr.** - Brooklyn Nets
7. **Darius Acuff Jr.** - Sacramento Kings
8. **Kingston Flemings** - Atlanta Hawks
9. **Morez Johnson Jr.** - Dallas Mavericks
10. **Brayden Burries** - Milwaukee Bucks

... plus 50 more players (60 total)

## Need More Help?

See `DEPLOYMENT_GUIDE.md` for:
- Detailed architecture explanation
- Step-by-step troubleshooting
- Environment variable reference
- Performance optimization tips
