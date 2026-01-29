#!/bin/bash

# Development script for running the game client

echo "🎨 Starting game client..."
echo ""
echo "Make sure the server is running in another terminal:"
echo "  cd server && npm run dev"
echo ""
echo "Once started, open http://localhost:4321 in multiple browser windows!"
echo ""

cd "$(dirname "$0")/client"
npm run dev
