# NBA Intelligence Platform - Deployment Guide

## Overview
This guide explains how to deploy both the frontend and backend, and how the configuration works in different environments.

## Architecture

- **Frontend**: React + Vite deployed on Vercel
- **Backend**: FastAPI deployed on Render
- **API Proxy**: Vercel proxies `/api/*` requests to the backend

## Backend Deployment (Render)

### Current Backend URL
```
https://basketball-hub-api-pesl.onrender.com/api
```

### Configuration Files
- `render.yaml` - Render service configuration
- `backend/requirements.txt` - Python dependencies
- `backend/main.py` - FastAPI application

### Environment Variables (Render Dashboard)
- `PORT` - Automatically set by Render (default: 10000)

### Health Check
- Path: `/api/health`
- Should return: `{"status":"healthy"}`

### Common Issues
1. **Cold Starts**: Free tier Render services sleep after 15 minutes of inactivity
2. **Timeout**: First request may take 30-60 seconds to wake up
3. **Build Failures**: Check Python version compatibility in `requirements.txt`

## Frontend Deployment (Vercel)

### Current Frontend URL
Your Vercel deployment URL (e.g., `https://your-app.vercel.app`)

### Configuration Files
- `frontend/vercel.json` - Vercel rewrites configuration
- `frontend/.env` - Production environment (should be empty or have no API URL)
- `frontend/.env.local` - Local development (git-ignored)
- `frontend/.env.example` - Template for environment variables

### How API Routing Works

#### Production (Vercel)
1. Frontend makes request to `/api/scoreboard`
2. Vercel proxy (via `vercel.json` rewrites) forwards to `https://basketball-hub-api-pesl.onrender.com/api/scoreboard`
3. Backend responds
4. Vercel returns response to frontend

**Why this works:**
- No CORS issues (same origin from browser perspective)
- Backend URL hidden from client
- Easy to change backend without rebuilding frontend

#### Local Development
1. Create `frontend/.env.local` with:
   ```
   VITE_API_BASE_URL=http://127.0.0.1:8000/api
   ```
2. Frontend makes requests directly to local backend
3. Backend CORS is configured to allow all origins (`allow_origins=["*"]`)

### Vercel Configuration (`vercel.json`)
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/api",
      "destination": "https://basketball-hub-api-pesl.onrender.com/api"
    },
    {
      "source": "/api/(.*)",
      "destination": "https://basketball-hub-api-pesl.onrender.com/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

## Local Development Setup

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend
```bash
cd frontend
npm install
# Create .env.local with local backend URL
echo "VITE_API_BASE_URL=http://127.0.0.1:8000/api" > .env.local
npm run dev
```

## Troubleshooting Deployment Issues

### Issue: "API backend is not configured"
**Cause**: Frontend can't determine the API URL
**Fix**: 
- Production: Ensure `frontend/.env` does NOT have `VITE_API_BASE_URL` set, so it uses `/api` proxy
- Local: Create `frontend/.env.local` with local backend URL

### Issue: CORS errors in production
**Cause**: Requests going directly to backend instead of through proxy
**Fix**: 
- Remove any `VITE_API_BASE_URL` from production `.env`
- Verify `vercel.json` rewrites are correct
- Redeploy frontend

### Issue: 502 Bad Gateway
**Cause**: Backend is down or unreachable
**Fix**:
- Check Render dashboard for backend status
- Wait 30-60 seconds for cold start
- Verify backend URL in `vercel.json` matches Render URL

### Issue: Backend works locally but not in production
**Cause**: Environment differences
**Fix**:
- Check Render logs for errors
- Verify all dependencies in `requirements.txt`
- Ensure `nba_api` is accessible (not blocked by Render)
- Check for missing environment variables

### Issue: Frontend builds but shows blank page
**Cause**: Build errors or incorrect routing
**Fix**:
- Check Vercel build logs
- Verify `index.html` routing in `vercel.json`
- Check browser console for errors

## Environment Variables Summary

### Backend (Render)
```bash
PORT=10000  # Auto-set by Render
```

### Frontend Development (`.env.local`)
```bash
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

### Frontend Production (`.env`)
```bash
# Leave empty or comment out VITE_API_BASE_URL
# This ensures the proxy configuration is used
```

## Deployment Checklist

### Initial Setup
- [ ] Backend deployed on Render
- [ ] Frontend deployed on Vercel
- [ ] Backend health check passing
- [ ] `vercel.json` rewrites configured
- [ ] Frontend `.env` empty or without API URL

### Before Each Deployment

**Backend:**
- [ ] Test locally first
- [ ] Verify all endpoints work
- [ ] Check Python dependencies
- [ ] Push to GitHub (triggers Render deploy)

**Frontend:**
- [ ] Test with local backend
- [ ] Run `npm run build` locally to check for errors
- [ ] Verify `.env` is not set to localhost
- [ ] Push to GitHub (triggers Vercel deploy)

### After Deployment
- [ ] Wait 1-2 minutes for deployment to complete
- [ ] Test deployed site
- [ ] Check browser console for errors
- [ ] Verify API calls are working
- [ ] Test on mobile device

## Performance Optimization

1. **Backend Caching**: 
   - Live data: 30 seconds
   - Player stats: 5 minutes
   - Historical data: 1 hour

2. **Frontend Caching**:
   - Client-side cache in `apiCache.ts`
   - Reduces API calls

3. **Keep Backend Warm**:
   - Use a service like UptimeRobot to ping `/api/health` every 5 minutes
   - Prevents cold starts

## Monitoring

- **Backend**: Check Render dashboard for logs and errors
- **Frontend**: Check Vercel dashboard for build logs and analytics
- **API Errors**: Check browser console and Network tab

## Support

If you encounter issues not covered here:
1. Check browser console for errors
2. Check Render logs for backend errors
3. Verify all URLs in configuration files
4. Test locally first to isolate the issue
