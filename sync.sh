#!/bin/bash
export PATH="/opt/homebrew/bin:$PATH"

cd "$(dirname "$0")"

echo "Pulling latest from GitHub..."
git pull

echo "Installing any new dependencies..."
npm install --silent

echo "Killing any existing server on port 3000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null

echo "Starting ANDROMEDA..."
node server.js
