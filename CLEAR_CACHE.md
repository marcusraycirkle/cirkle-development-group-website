# Clear Browser Cache Instructions

## The Problem
You're seeing old JavaScript errors because your browser has cached the old version of the files. The syntax errors have been fixed, but you need to clear your cache.

## Solution: Hard Refresh

### Windows/Linux:
- **Chrome/Edge/Firefox**: Press `Ctrl + Shift + R` or `Ctrl + F5`
- **Alternative**: Press `Ctrl + Shift + Delete` to open clear cache dialog

### Mac:
- **Chrome/Edge**: Press `Cmd + Shift + R`
- **Safari**: Press `Cmd + Option + E` (empty caches) then `Cmd + R` (refresh)
- **Firefox**: Press `Cmd + Shift + R`

### Or Use Developer Tools:
1. Press `F12` to open DevTools
2. **Right-click** the refresh button (next to address bar)
3. Select **"Empty Cache and Hard Reload"** or **"Clear Cache and Hard Reload"**

## What This Does
A hard refresh forces the browser to:
- Download fresh copies of all JavaScript files
- Ignore cached versions
- Load the fixed code without syntax errors

## After Hard Refresh
You should see:
- ✅ No more "Unexpected token '.'" errors in auth.js
- ✅ Dashboard loads properly
- ❌ Still see "Discord OAuth failed: invalid_client" (this is expected - you need to update Discord credentials)

## Next Steps After Cache Clear

Once the cache is cleared, you still need to fix the Discord OAuth credentials:

```bash
cd /workspaces/cirkle-development-group-website

npx wrangler secret put DISCORD_CLIENT_ID
# Enter: 1417915896634277888

npx wrangler secret put DISCORD_CLIENT_SECRET
# Paste your Discord Client Secret

npx wrangler secret put DISCORD_REDIRECT_URI
# Enter: https://group.cirkledevelopment.co.uk/consumer/login.html
```

## Verify It Worked

After hard refresh, check the browser console (F12):
- Old error: `Uncaught SyntaxError: Unexpected token '.' (at auth.js:432:10)`
- Should be gone ✅

If you still see syntax errors, try:
1. Close ALL browser windows/tabs for the site
2. Reopen browser
3. Go to the site URL
4. Hard refresh again
