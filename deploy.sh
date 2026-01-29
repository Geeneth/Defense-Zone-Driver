#!/bin/bash

# Deployment script for Fly.io

echo "🚀 Building and deploying to Fly.io..."

# Check if fly CLI is installed
if ! command -v fly &> /dev/null
then
    echo "❌ Fly CLI not found. Install it first:"
    echo "curl -L https://fly.io/install.sh | sh"
    exit 1
fi

# Deploy
fly deploy

echo "✅ Deployment complete!"
echo "📊 Check status: fly status"
echo "📝 View logs: fly logs"
