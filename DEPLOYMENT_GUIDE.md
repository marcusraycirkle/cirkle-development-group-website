# Deployment Guide - Cirkle Development Group

## 🚀 Complete Deployment Instructions

### Phase 1: Set Up Cloudflare Workers

#### 1.1 Install Prerequisites
```bash
# Install Node.js (if not already installed)
# Download from: https://nodejs.org/

# Install Wrangler CLI globally
npm install -g wrangler

# Verify installation
wrangler --version
```

#### 1.2 Login to Cloudflare
```bash
wrangler login
```
This will open a browser window for authentication.

#### 1.3 Create KV Namespaces
```bash
# Create production namespaces
wrangler kv:namespace create "USERS"
wrangler kv:namespace create "SESSIONS"
wrangler kv:namespace create "BLOGS"
wrangler kv:namespace create "BLOG_SUGGESTIONS"

# Create preview namespaces for testing
wrangler kv:namespace create "USERS" --preview
wrangler kv:namespace create "SESSIONS" --preview
wrangler kv:namespace create "BLOGS" --preview
wrangler kv:namespace create "BLOG_SUGGESTIONS" --preview
```

**IMPORTANT**: Copy all the IDs returned and update `wrangler.toml`:
```toml
kv_namespaces = [
  { binding = "USERS", id = "PASTE_USERS_ID_HERE", preview_id = "PASTE_PREVIEW_ID_HERE" },
  { binding = "SESSIONS", id = "PASTE_SESSIONS_ID_HERE", preview_id = "PASTE_PREVIEW_ID_HERE" },
  { binding = "BLOGS", id = "PASTE_BLOGS_ID_HERE", preview_id = "PASTE_PREVIEW_ID_HERE" },
  { binding = "BLOG_SUGGESTIONS", id = "PASTE_SUGGESTIONS_ID_HERE", preview_id = "PASTE_PREVIEW_ID_HERE" }
]
```

### Phase 2: Configure Discord OAuth

#### 2.1 Create Discord Application
1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Name it "Cirkle Development Group"
4. Navigate to "OAuth2" → "General"
5. Add Redirect URI: `https://cirkledevelopment.co.uk/consumer/login.html?callback`
   - OR for testing: `http://localhost:8787/consumer/login.html?callback`
6. Under "OAuth2" → "URL Generator":
   - Select scopes: `identify`, `email`
   - Copy your generated URL for testing
7. Go to "OAuth2" tab and copy:
   - Client ID
   - Client Secret (click "Reset Secret" if needed)

#### 2.2 Set Discord Secrets in Cloudflare
```bash
# Set Client ID
wrangler secret put DISCORD_CLIENT_ID
# When prompted, paste your Discord Client ID

# Set Client Secret
wrangler secret put DISCORD_CLIENT_SECRET
# When prompted, paste your Discord Client Secret

# Set Redirect URI
wrangler secret put DISCORD_REDIRECT_URI
# Enter: https://cirkledevelopment.co.uk/consumer/login.html?callback
```

### Phase 3: MyCirkle Integration

MyCirkle verification is pre-configured and uses a public API endpoint:
- Endpoint: `https://mycirkle-auth.marcusray.workers.dev/api/verify-membership`
- No API key required
- Automatically verifies membership via Discord ID
- No additional configuration needed ✅

### Phase 4: Generate Security Secrets

#### 4.1 Generate JWT Secret
```bash
# On Mac/Linux:
openssl rand -base64 32

# On Windows (PowerShell):
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

# Then set it:
wrangler secret put JWT_SECRET
# Paste the generated secret
```

### Phase 5: Deploy the Worker

#### 5.1 Test Locally First
```bash
# Start local development server
wrangler dev

# Test the API
curl http://localhost:8787/api/health
```

#### 5.2 Deploy to Production
```bash
# Deploy your worker
wrangler deploy

# Verify deployment
curl https://cirkledevelopment.co.uk/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": 1704067200000
}
```

### Phase 6: Configure DNS (if not already done)

#### 6.1 Add Route to Cloudflare
1. Log in to Cloudflare Dashboard
2. Select your domain (cirkledevelopment.co.uk)
3. Go to "Workers Routes"
4. Add route: `cirkledevelopment.co.uk/api/*`
5. Select your worker: `cirkle-api`

#### 6.2 Verify DNS Settings
Ensure your domain points to Cloudflare nameservers.

### Phase 7: Update Frontend Configuration

#### 7.1 Update API Base URL
In `js/api-client.js`, verify the production URL:
```javascript
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:8787/api'
  : 'https://cirkledevelopment.co.uk/api';
```

#### 7.2 Deploy Frontend
```bash
# If using GitHub Pages
git add .
git commit -m "Add Cloudflare backend integration"
git push origin main

# If using Cloudflare Pages
wrangler pages deploy .
```

### Phase 8: Testing

#### 8.1 Test Discord OAuth Flow
1. Visit `https://cirkledevelopment.co.uk/consumer/login.html`
2. Click "Continue with Discord"
3. Authorize the application
4. Verify you're redirected back with authentication

#### 8.2 Test MyCirkle Verification
1. After Discord login, the MyCirkle modal should appear
2. Click "Verify Membership"
3. Check if verification works correctly

#### 8.3 Test Cross-Device Sync
1. Login on one device
2. Login on another device with same Discord account
3. Verify profile data syncs correctly

### Phase 9: Monitor and Maintain

#### 9.1 View Logs
```bash
# Stream live logs
wrangler tail

# View analytics in Cloudflare Dashboard
# Workers → cirkle-api → Analytics
```

#### 9.2 Check KV Storage
```bash
# List keys in a namespace
wrangler kv:key list --binding=USERS

# Get a specific key
wrangler kv:key get "user:USER_ID" --binding=USERS
```

#### 9.3 Update Secrets (if needed)
```bash
# List all secrets (won't show values)
wrangler secret list

# Update a secret
wrangler secret put SECRET_NAME
```

## 🔒 Security Checklist

- [ ] All secrets set via `wrangler secret put` (never in code)
- [ ] `.gitignore` includes `.env`, `.dev.vars`, `secrets.txt`
- [ ] Discord OAuth redirect URI matches exactly
- [ ] CORS headers properly configured
- [ ] Rate limiting enabled (optional but recommended)
- [ ] Regular security audits scheduled

## 🐛 Troubleshooting

### "Unauthorized" errors
```bash
# Check if secrets are set
wrangler secret list

# Verify session token in browser
localStorage.getItem('sessionToken')
```

### Discord OAuth fails
- Verify redirect URI matches exactly (including https://)
- Check Discord application status
- Ensure scopes are correct: `identify`, `email`

### MyCirkle verification fails
- Check MyCirkle API key is valid
- Verify MyCirkle API is accessible
- Check worker logs: `wrangler tail`

### KV data not persisting
- Verify namespace IDs in `wrangler.toml`
- Check KV quota in Cloudflare dashboard
- Ensure write operations complete before reading

## 📊 Monitoring

### Key Metrics to Watch
- Request rate (requests/second)
- Error rate (errors/total requests)
- KV read/write operations
- Worker CPU time
- Memory usage

### Set Up Alerts
1. Go to Cloudflare Dashboard
2. Workers → cirkle-api → Alerts
3. Configure alerts for:
   - High error rate (>5%)
   - High CPU time (>10ms average)
   - KV quota warnings

## 🔄 Updating

### To update the worker:
```bash
# Make your changes
git pull  # or make changes locally

# Test locally
wrangler dev

# Deploy
wrangler deploy
```

### To rollback:
```bash
# List deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback
```

## 📞 Support

If you encounter issues:

1. Check logs: `wrangler tail`
2. Review Cloudflare Dashboard analytics
3. Check Discord Developer Portal for OAuth issues
4. Contact MyCirkle team for API issues
5. Review this documentation

## ✅ Post-Deployment Checklist

- [ ] Health check endpoint responds: `/api/health`
- [ ] Discord OAuth flow works end-to-end
- [ ] MyCirkle verification works
- [ ] Users can login and logout
- [ ] Profile data persists across devices
- [ ] MyCirkle badges display correctly
- [ ] All secrets are set and secured
- [ ] Monitoring and alerts configured
- [ ] Documentation updated
- [ ] Team trained on new system

---

**Deployment Date**: _____________
**Deployed By**: _____________
**Version**: 2.0
**Last Updated**: January 1, 2026
