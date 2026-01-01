# Cloudflare Backend Setup Guide

## Overview
This guide will help you set up the Cloudflare Workers backend for the Cirkle Development Group website, enabling:
- Cross-device user authentication
- Discord OAuth integration
- MyCirkle membership verification
- Secure data storage with Cloudflare KV

## Prerequisites
- Cloudflare account with Workers enabled
- Discord Developer Application
- MyCirkle API access
- Node.js and npm installed

## Step 1: Install Wrangler CLI

```bash
npm install -g wrangler
```

## Step 2: Login to Cloudflare

```bash
wrangler login
```

## Step 3: Create KV Namespaces

Run these commands and note the IDs returned:

```bash
# Production namespaces
wrangler kv:namespace create "USERS"
wrangler kv:namespace create "SESSIONS"
wrangler kv:namespace create "BLOGS"
wrangler kv:namespace create "BLOG_SUGGESTIONS"

# Preview namespaces (for testing)
wrangler kv:namespace create "USERS" --preview
wrangler kv:namespace create "SESSIONS" --preview
wrangler kv:namespace create "BLOGS" --preview
wrangler kv:namespace create "BLOG_SUGGESTIONS" --preview
```

## Step 4: Update wrangler.toml

Replace the namespace IDs in `wrangler.toml` with the ones you just created:

```toml
kv_namespaces = [
  { binding = "USERS", id = "YOUR_USERS_ID", preview_id = "YOUR_USERS_PREVIEW_ID" },
  { binding = "SESSIONS", id = "YOUR_SESSIONS_ID", preview_id = "YOUR_SESSIONS_PREVIEW_ID" },
  { binding = "BLOGS", id = "YOUR_BLOGS_ID", preview_id = "YOUR_BLOGS_PREVIEW_ID" },
  { binding = "BLOG_SUGGESTIONS", id = "YOUR_SUGGESTIONS_ID", preview_id = "YOUR_SUGGESTIONS_PREVIEW_ID" }
]
```

## Step 5: Configure Discord OAuth

### Create Discord Application
1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Name it "Cirkle Development Group"
4. Go to OAuth2 settings
5. Add redirect URI: `https://cirkledevelopment.co.uk/auth/callback`
6. Select scopes: `identify`, `email`
7. Copy your Client ID and Client Secret

### Set Discord Secrets

```bash
wrangler secret put DISCORD_CLIENT_ID
# Paste your Discord Client ID

wrangler secret put DISCORD_CLIENT_SECRET
# Paste your Discord Client Secret

wrangler secret put DISCORD_REDIRECT_URI
# Enter: https://cirkledevelopment.co.uk/auth/callback
```

## Step 6: MyCirkle Integration

The MyCirkle verification API is already configured and uses a public endpoint:
- `https://mycirkle-auth.marcusray.workers.dev/api/verify-membership`
- No API key required
- Automatically verifies Discord users

## Step 7: Generate JWT Secret

```bash6
# Generate a random secret
openssl rand -base64 32

# Set it as a secret
wrangler secret put JWT_SECRET
# Paste the generated secret
```

## Step 8: Deploy the Worker

```bash7
wrangler deploy
```

## Step 9: Test the API

```bash8
# Health check
curl https://cirkledevelopment.co.uk/api/health

# Should return: {"status":"ok","timestamp":...}
```

## API Endpoints

### Authentication
- `GET /api/auth/discord/url` - Get Discord OAuth URL
- `POST /api/auth/discord/callback` - Handle Discord OAuth callback
- `POST /api/auth/verify-mycirkle` - Verify MyCirkle membership
- `POST /api/auth/complete-profile` - Complete profile setup (bio)
- `POST /api/auth/logout` - Logout user

### Users
- `GET /api/users/me` - Get current user
- `PUT /api/users/me` - Update current user profile
- `GET /api/users/:id` - Get user by ID

## Environment Variables

Set in `wrangler.toml`:
- `ENVIRONMENT` - production/development
- `MYCIRKLE_API_URL` - MyCirkle API base URL
- `FRONTEND_URL` - Your website URL

## Secrets (Set via wrangler secret put)
- `DISCORD_CLIENT_ID` - Discord OAuth Client ID
- `DISCORD_CLIENT_SECRET` - Discord OAuth Client Secret
- `DISCORD_REDIRECT_URI` - Discord OAuth redirect URI
- `MYCIRKLE_API_KEY` - MyCirkle API key
- `JWT_SECRET` - Secret for session tokens
Security Notes

1. **Never commit secrets to Git**
2. **Use different credentials for development/production**
3. **Rotate secrets regularly**
4. **Monitor API usage in Cloudflare dashboard**
5. **Enable rate limiting if needed**

## Troubleshooting

### Worker not deploying
```bash
# Check for syntax errors
wrangler deploy --dry-run

# View logs
wrangler tail
```

### KV data not persisting
- Verify namespace IDs in wrangler.toml
- Check quota limits in Cloudflare dashboard

### Discord OAuth failing
- Verify redirect URI matches exactly
- Check scopes are set correctly
- Ensure secrets are set properly

## MyCirkle API Expected Format

Your MyCirkle API should accept:
```jsonIntegration

The MyCirkle verification uses the endpoint:
```javascript
POST https://mycirkle-auth.marcusray.workers.dev/api/verify-membership
Content-Type: application/json

{
  "discordId": "123456789012345678"
}
```

Returns:
```json
{
  "verified": true,
  "tier": "gold",
  "memberSince": "2025-01-01T00:00:00Z"
}
```

No API key required - the endpoint is publicly accessible.
For issues:
1. Check Cloudflare Workers logs: `wrangler tail`
2. Verify all secrets are set: `wrangler secret list`
3. Test locally: `wrangler dev`

## Next Steps

After deployment:
1. Update frontend to use API endpoints
2. Test Discord OAuth flow
3. Test MyCirkle verification
4. Migrate existing localStorage data (if needed)
