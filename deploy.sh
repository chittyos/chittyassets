#!/bin/bash

# ChittyAssets Cloudflare Deployment Script

echo "🚀 Deploying ChittyAssets to Cloudflare..."

# Check if authenticated
if ! wrangler whoami > /dev/null 2>&1; then
    echo "❌ Not authenticated with Cloudflare"
    echo "Please run: wrangler auth login"
    echo "Or set CLOUDFLARE_API_TOKEN environment variable"
    exit 1
fi

# Build the application
echo "🔨 Building application..."
npm run build

# Copy Cloudflare configuration files
echo "📁 Copying configuration files..."
cp _headers dist/public/
cp _redirects dist/public/

# Deploy frontend to Cloudflare Pages
echo "🌐 Deploying frontend to Cloudflare Pages..."
wrangler pages deploy dist/public --project-name chittyassets --compatibility-date 2024-01-01

# Deploy backend API as Cloudflare Worker
echo "⚡ Deploying backend API as Cloudflare Worker..."
cf deploy --name chittyassets-api

echo "✅ Deployment complete!"
echo "Frontend: https://chittyassets.pages.dev"
echo "Backend API: https://chittyassets-api.your-subdomain.workers.dev"