#!/bin/bash

# Cirkle Development Group - Cloudflare Setup Script
echo "🚀 Setting up Cloudflare Workers for Cirkle Development Group..."
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Installing..."
    npm install -g wrangler
fi

echo "✅ Wrangler CLI found"
echo ""

# Login to Cloudflare
echo "📝 Please login to Cloudflare..."
wrangler login

echo ""
echo "🔑 Now let's set up your secrets. You'll need:"
echo "  1. Discord OAuth credentials"
echo "  2. JWT secret"
echo ""
echo "Note: MyCirkle integration is pre-configured with public API"
echo ""

# Set Discord OAuth secrets
echo "Setting up Discord OAuth..."
echo "Get your Discord OAuth credentials from: https://discord.com/developers/applications"
echo ""
read -p "Enter your Discord Client ID: " DISCORD_CLIENT_ID
wrangler secret put DISCORD_CLIENT_ID <<< "$DISCORD_CLIENT_ID"

read -sp "Enter your Discord Client Secret: " DISCORD_CLIENT_SECRET
echo ""
wrangler secret put DISCORD_CLIENT_SECRET <<< "$DISCORD_CLIENT_SECRET"

read -p "Enter your Discord Redirect URI (e.g., https://cirkledevelopment.co.uk/auth/callback): " DISCORD_REDIRECT_URI
wrangler secret put DISCORD_REDIRECT_URI <<< "$DISCORD_REDIRECT_URI"

echo ""
echo "✅ Discord OAuth configured"
echo ""

# MyCirkle is pre-configured
echo "✅ MyCirkle integration is pre-configured (no API key needed)"
echo ""

# Generate JWT secret
echo "Generating JWT secret..."
JWT_SECRET=$(openssl rand -base64 32)
wrangler secret put JWT_SECRET <<< "$JWT_SECRET"
echo "✅ JWT secret generated"
echo ""

# Create KV namespaces
echo "📦 Creating KV namespaces..."
wrangler kv:namespace create "USERS"
wrangler kv:namespace create "SESSIONS"
wrangler kv:namespace create "BLOGS"
wrangler kv:namespace create "BLOG_SUGGESTIONS"

echo ""
echo "⚠️  IMPORTANT: Copy the namespace IDs from above and update wrangler.toml"
echo ""

# Create preview namespaces
echo "Creating preview namespaces..."
wrangler kv:namespace create "USERS" --preview
wrangler kv:namespace create "SESSIONS" --preview
wrangler kv:namespace create "BLOGS" --preview
wrangler kv:namespace create "BLOG_SUGGESTIONS" --preview

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update wrangler.toml with the KV namespace IDs"
echo "2. Deploy your worker: wrangler deploy"
echo "3. Test your API: curl https://cirkledevelopment.co.uk/api/health"
echo ""
