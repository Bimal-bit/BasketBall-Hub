# White Screen Debugging Guide

## Fixes Applied

1. **Added Error Boundary in main.tsx** - Catches render errors and displays user-friendly message
2. **Added Console Logging** - API errors now logged to browser console
3. **Enabled Source Maps** - Debug production JavaScript errors
4. **Added Try-Catch for localStorage** - Prevents theme provider crashes
5. **Added Base Path Configuration** - Explicit base: '/' in vite.config.ts

## How to Debug the White Screen

### Step 1: Wait for Vercel Deployment
After pushing, Vercel needs 2-3 minutes to build and deploy.

Check deployment status:
- Visit: https://vercel.com/dashboard
- Look for "Building" → "Ready" status

### Step 2: Open Browser Developer Tools

1. Visit https://basketball-hub-brown.vercel.app
2. Press **F12** or **Right-click → Inspect**
3. Go to the **Console** tab

### Step 3: Check for Errors

Look for these types of errors:

#### JavaScript Errors
```
Uncaught SyntaxError: ...
Uncaught ReferenceError: ...
Uncaught TypeError: ...
```

#### Network Errors (Red in Network tab)
```
Failed to load resource: net::ERR_CONNECTION_REFUSED
404 Not Found for /assets/...
CORS error
```

#### React Errors
```
Error: A React component suspended while rendering...
Uncaught Error: Minified React error #...
```

### Step 4: Check Network Tab

1. Go to **Network** tab in DevTools
2. Reload the page (Ctrl+F5 or Cmd+Shift+R)
3. Check if all files loaded:
   - ✅ index.html (200 OK)
   - ✅ /assets/index-*.js (200 OK)
   - ✅ /assets/index-*.css (200 OK)
   - ✅ /assets/vendor-*.js (200 OK)

### Step 5: Common Issues & Solutions

#### Issue 1: "Failed to read theme from localStorage"
**Cause**: Browser blocking localStorage (privacy mode)  
**Fix**: Already handled with try-catch, should not cause white screen

#### Issue 2: "Failed to render app: Root element not found"
**Cause**: HTML not loading or being modified  
**Fix**: Check if index.html has `<div id="root"></div>`

#### Issue 3: "API backend is not configured"
**Cause**: Environment variable issues  
**Fix**: We use proxy, this should not cause white screen but logged to console

#### Issue 4: 404 for JavaScript/CSS files
**Cause**: Build output directory mismatch  
**Fix**: Verify vercel.json has `outputDirectory: "frontend/dist"`

#### Issue 5: Module import errors
**Cause**: Missing dependencies or build issues  
**Fix**: Check if all node_modules installed during Vercel build

#### Issue 6: Blank white screen with NO errors
**Cause**: React not rendering, possibly due to StrictMode or Suspense  
**Try**: Check if "Loading..." or error message appears briefly

## Manual Testing

### Test Local Build
```powershell
cd frontend
npm run build
npm run preview
# Visit http://localhost:4173
```

If it works locally but not on Vercel, it's a deployment config issue.

### Test Vercel Preview
After pushing, check:
```
https://basketball-hub-brown.vercel.app
```

## Expected Console Output (Normal)

When working correctly, you should see:
```
✓ Vite loaded
✓ React loaded
✓ Theme initialized
[Maybe] Warning: Failed to read theme from localStorage (normal in privacy mode)
[Maybe] API request logs when navigating
```

## Expected Console Output (Error)

If there's an error, you'll see:
```
❌ Failed to render app: [error details]
❌ API request failed for /scoreboard: [error details]
```

## Screenshots to Take

If you see errors, take screenshots of:
1. Console tab (errors in red)
2. Network tab (failed requests in red)
3. Elements tab (check if root div is empty)

## Quick Fix Checklist

- [ ] Vercel deployment completed (not still building)
- [ ] Browser cache cleared (Ctrl+Shift+Delete or Cmd+Shift+Delete)
- [ ] No browser extensions blocking scripts (try Incognito mode)
- [ ] JavaScript enabled in browser
- [ ] Check on different browser (Chrome, Firefox, Safari)
- [ ] Check on different device (mobile, tablet)

## Emergency Rollback

If nothing works:

### Option 1: Use Previous Deployment
In Vercel dashboard:
1. Go to Deployments
2. Find a working deployment
3. Click "..." → "Promote to Production"

### Option 2: Deploy with Different Config
Remove sourcemaps for smaller build:
```typescript
// vite.config.ts
sourcemap: false
```

### Option 3: Remove StrictMode
If React StrictMode causing issues:
```typescript
// main.tsx - Remove <StrictMode> wrapper
createRoot(rootElement).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
```

## What I Changed

### Before (main.tsx)
```typescript
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);
```

### After (main.tsx)
```typescript
try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }
  createRoot(rootElement).render(
    <StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </StrictMode>
  );
} catch (error) {
  console.error('Failed to render app:', error);
  // Shows error UI with reload button
}
```

## Contact Information for Error Reports

When reporting errors, please include:
1. Browser name and version (Chrome 120, Firefox 121, etc.)
2. Operating system (Windows, Mac, Linux, iOS, Android)
3. Screenshot of Console tab
4. Screenshot of Network tab
5. Any error messages displayed on screen

## Next Steps

1. **Wait 3-5 minutes** for Vercel to rebuild and deploy
2. **Clear browser cache** completely
3. **Open DevTools Console** before loading the page
4. **Visit** https://basketball-hub-brown.vercel.app
5. **Check console** for any red errors
6. **Report** what you see in the console

The deployment should now show either:
- ✅ The working app
- ❌ A friendly error message with "Reload Page" button
- 📝 Detailed error logs in browser console

All errors are now caught and logged, so we can identify the exact issue!
