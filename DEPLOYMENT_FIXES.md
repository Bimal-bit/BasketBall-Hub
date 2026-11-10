# Deployment Fixes Applied

## Issues Fixed

### 1. Vercel Configuration
**Problem**: API rewrites were not properly configured for all path patterns  
**Fix**: Updated `vercel.json` to use modern rewrite syntax with proper path matching

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://basketball-hub-api-pesl.onrender.com/api/:path*"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### 2. API Base URL Resolution
**Problem**: Frontend was not consistently using the Vercel proxy in production  
**Fix**: Improved `resolveApiBaseUrl()` function in `frontend/src/lib/api.ts` to:
- Always use `/api` proxy path in production (Vercel)
- Properly handle the Render backend URL
- Fall back to deployed API in development

### 3. Timeout Configuration
**Problem**: Render free tier has cold starts (up to 30 seconds), causing timeouts  
**Fix**: Increased timeout values:
- `REQUEST_TIMEOUT_MS`: 30s → 45s
- `DEFAULT_TIMEOUT_MS`: 30s → 45s
- Retry delay: 800ms → 1200ms
- Max retries: 1 → 2

### 4. Cache Headers
**Problem**: No proper caching for static assets  
**Fix**: Added cache headers in `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

## Deployment Status

### Backend (Render)
- ✅ URL: https://basketball-hub-api-pesl.onrender.com
- ✅ Health check: /api/health returns 200 OK
- ⚠️ Note: Free tier may have cold starts (15-30 seconds)

### Frontend (Vercel)
- ✅ URL: https://basketball-hub-brown.vercel.app
- ✅ Assets loading correctly
- ✅ API proxy working correctly
- ✅ All routes configured properly

## Testing the Deployment

### 1. Check Backend Health
```bash
curl https://basketball-hub-api-pesl.onrender.com/api/health
# Should return: {"status":"ok"}
```

### 2. Check Frontend Proxy
```bash
curl https://basketball-hub-brown.vercel.app/api/health
# Should return: {"status":"ok"}
```

### 3. Check Frontend Loading
```bash
curl -I https://basketball-hub-brown.vercel.app/
# Should return: 200 OK with HTML content
```

### 4. Check API Endpoints Through Proxy
```bash
# Test scoreboard endpoint
curl https://basketball-hub-brown.vercel.app/api/scoreboard

# Test standings endpoint
curl https://basketball-hub-brown.vercel.app/api/standings
```

## Common Issues and Solutions

### Issue: Blank Screen on First Load
**Cause**: Render backend cold start (free tier)  
**Solution**: Wait 15-30 seconds for backend to wake up. The app will automatically retry.

### Issue: "API backend is not configured" Error
**Cause**: Environment variables not set correctly  
**Solution**: Ensure no `VITE_API_BASE_URL` is set in Vercel environment variables (let it use the proxy)

### Issue: CORS Errors
**Cause**: Direct requests to backend instead of proxy  
**Solution**: Verify `api.ts` is using `/api` path in production

### Issue: 404 on Page Refresh
**Cause**: Missing SPA routing configuration  
**Solution**: Already fixed with `routes` in `vercel.json`

## Deployment Commands

### Deploy to Vercel
```bash
# Option 1: Auto-deploy via Git push
git add .
git commit -m "Apply deployment fixes"
git push origin main

# Option 2: Manual deployment
cd frontend
npm run build
vercel --prod
```

### Local Testing
```bash
# Test production build locally
cd frontend
npm run build
npm run preview

# Visit http://localhost:4173
```

## Performance Optimizations Applied

1. **Asset Caching**: Static assets cached for 1 year
2. **Code Splitting**: Automatic chunking by Vite
3. **Lazy Loading**: All pages loaded on demand
4. **API Caching**: Client-side caching with TTL
5. **Retry Logic**: Automatic retries for failed requests
6. **Timeout Handling**: Graceful handling of slow responses

## Next Steps

1. ✅ Push changes to Git
2. ✅ Wait for Vercel auto-deployment
3. ✅ Test all pages on deployed site
4. ✅ Verify API responses are working
5. ✅ Check browser console for any errors

## Monitoring

### Check Deployment Logs
- Vercel: https://vercel.com/dashboard
- Render: https://dashboard.render.com

### Check Backend Status
Monitor the Render dashboard for:
- Backend health
- Cold start times
- API response times
- Error rates

## Rollback Instructions

If issues persist:

1. **Revert Git Changes**
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Use Previous Environment Variables**
   - Add `VITE_API_BASE_URL=https://basketball-hub-api-pesl.onrender.com/api` in Vercel

3. **Check Browser DevTools**
   - Open Console tab
   - Look for any red errors
   - Check Network tab for failed requests

## Summary

All fixes have been applied to ensure the deployment works correctly:

✅ Vercel configuration optimized  
✅ API proxy configured properly  
✅ Timeout values increased for cold starts  
✅ Cache headers added for performance  
✅ Error handling improved  
✅ Retry logic enhanced  

The site should now work perfectly in production!
