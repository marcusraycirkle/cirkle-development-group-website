# Fix Discord OAuth - Invalid Client Error

## Current Issue
Getting **`invalid_client`** error from Discord OAuth. This means the Discord credentials in Cloudflare secrets are incorrect.

## Solution Steps

### Step 1: Verify Discord Application Settings

1. Go to: https://discord.com/developers/applications/1417915896634277888/oauth2
2. Verify **Redirect URIs** includes:
   ```
   https://group.cirkledevelopment.co.uk/consumer/login.html
   ```
3. Note your **Client ID**: Should be `1417915896634277888`
4. Get your **Client Secret** (you may need to reset it if you don't have it saved)

### Step 2: Update Cloudflare Secrets

Run these commands in your terminal:

```bash
# Navigate to project directory
cd /workspaces/cirkle-development-group-website

# Update Discord Client ID
npx wrangler secret put DISCORD_CLIENT_ID
# When prompted, enter: 1417915896634277888

# Update Discord Client Secret
npx wrangler secret put DISCORD_CLIENT_SECRET
# When prompted, paste your Discord Client Secret from Step 1

# Update Discord Redirect URI
npx wrangler secret put DISCORD_REDIRECT_URI
# When prompted, enter: https://group.cirkledevelopment.co.uk/consumer/login.html
```

### Step 3: If You Lost the Client Secret

If you don't have the Discord Client Secret saved:

1. Go to: https://discord.com/developers/applications/1417915896634277888/oauth2
2. Under **Client Secret**, click **"Reset Secret"**
3. **IMMEDIATELY COPY** the new secret (you won't be able to see it again)
4. Run: `npx wrangler secret put DISCORD_CLIENT_SECRET`
5. Paste the new secret when prompted

### Step 4: Verify All Secrets Are Set

After setting the secrets, you can verify they exist (but not see their values):

```bash
npx wrangler secret list
```

You should see:
- DISCORD_CLIENT_ID
- DISCORD_CLIENT_SECRET
- DISCORD_REDIRECT_URI
- JWT_SECRET

### Step 5: Test the Login

1. Clear your browser cache and cookies for group.cirkledevelopment.co.uk
2. Go to: https://group.cirkledevelopment.co.uk/consumer/login.html
3. Check all 3 agreement boxes
4. Click **"Continue with Discord"**
5. Complete the OAuth flow

## Multiple Website Support

If you're using this Discord app for multiple websites, make sure ALL redirect URIs are added in Discord Developer Portal:

Example:
```
https://group.cirkledevelopment.co.uk/consumer/login.html
https://example.com/auth/callback
https://another-site.com/login
```

## Troubleshooting

If you still get errors after updating secrets:

1. **Check Discord Developer Portal**: Make sure the redirect URI matches EXACTLY
2. **Wait a few seconds**: Cloudflare secrets can take a moment to propagate
3. **Check browser console**: Look for specific error messages
4. **Try incognito mode**: Eliminate browser cache issues

## Common Mistakes

❌ **Wrong Client ID format** - Should be numbers only (18-19 digits)  
❌ **Extra spaces in secrets** - Paste the secret exactly as shown  
❌ **Old redirect URI** - Must use group.cirkledevelopment.co.uk (not cirkledevelopment.co.uk)  
❌ **Missing HTTPS** - Redirect URI must start with `https://`

## Need Help?

If you're still stuck, check the browser console (F12) for detailed error messages. The error will now show the exact Discord API response.
