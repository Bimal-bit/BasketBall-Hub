# 429 Rate Limit Fix

## Problem

The deployed site was showing **429 Too Many Requests** errors, causing no data to load.

### Root Cause
1. Health check was running immediately on page load
2. No caching on health check endpoint
3. Every component making API calls simultaneously
4. No edge caching on Vercel proxy

## Fixes Applied

### 1. Added Health Check Caching (30 seconds)
```typescript
// api.ts - Cache health checks for 30 seconds
const cache = new Map<string, { data: unknown; expires: number }>();

export async function checkBackendHealth() {
  const cached = cache.get('backend_health_check');
  if (cached && cached.expires > Date.now()) {
    return cached.data as boolean; // Return cached result
  }
  // ... make request and cache result
}
```

### 2. Delayed Initial Health Check
```typescript
// App.tsx - Wait 1 second before first health check
const initialTimeout = setTimeout(checkBackend, 1000);
```

### 3. Added Vercel Edge Caching
```json
// vercel.json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, s-maxage=60, stale-while-revalidate=300"
        }
      ]
    }
  ]
}
```

### 4. Better Error Handling
```typescript
const checkBackend = async () => {
  try {
    const ok = await checkBackendHealth();
    if (mounted) setBackendOk(ok);
  } catch (error) {
    console.warn('Backend health check failed:', error);
    if (mounted) setBackendOk(false);
  }
};
```

## Testing

### Before Fix:
```bash
curl https://basketball-hub-brown.vercel.app/api/health
# 429 Too Many Requests
```

### After Fix (wait 3-5 minutes for deployment):
```bash
curl https://basketball-hub-brown.vercel.app/api/health
# {"status":"ok"}
```

## Why This Works

1. **Health Check Caching**: Prevents multiple health checks within 30 seconds
2. **Initial Delay**: Avoids immediate request burst on page load
3. **Edge Caching**: Vercel caches API responses for 60 seconds at the edge
4. **Stale-While-Revalidate**: Serves cached content while fetching fresh data
5. **Error Handling**: Prevents crashes when health check fails

## Deployment Timeline

1. ✅ Changes committed and pushed
2. ⏳ Vercel building (2-3 minutes)
3. ⏳ New version deploying
4. ✅ Rate limits should be resolved

## How to Verify

### Wait 5 minutes, then test:

```powershell
# Test API health
curl https://basketball-hub-brown.vercel.app/api/health

# Test scoreboard
curl https://basketball-hub-brown.vercel.app/api/scoreboard

# Visit site
Start-Process "https://basketball-hub-brown.vercel.app"
```

### Expected Results:
- ✅ No 429 errors
- ✅ Data loads on dashboard
- ✅ NBA games/scores visible
- ✅ All pages working

## If Still 429 After Deployment

### Temporary Solution:
Wait 5-10 minutes for rate limit window to reset on Render's side.

### Permanent Solution (if issues persist):
1. **Add Redis caching** to backend
2. **Implement request throttling** on frontend
3. **Upgrade Render plan** (free tier has strict limits)
4. **Use Vercel Functions** instead of external backend

## Monitoring

Check these after deployment:
- Vercel Dashboard: https://vercel.com/dashboard
- Render Dashboard: https://dashboard.render.com
- Site: https://basketball-hub-brown.vercel.app

## Summary

✅ Added 30-second caching for health checks  
✅ Delayed initial health check by 1 second  
✅ Added Vercel edge caching (60s with stale-while-revalidate)  
✅ Improved error handling  
✅ Reduced request frequency  

**The 429 rate limit issue should be resolved after deployment completes!**
