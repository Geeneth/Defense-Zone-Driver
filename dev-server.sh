#!/bin/bash

# Development script for running the game server

echo "🎮 Starting game server..."
echo ""
echo "Make sure to run the client in a separate terminal:"
echo "  cd client && npm run dev"
echo ""

cd "$(dirname "$0")/server"
npm run dev
