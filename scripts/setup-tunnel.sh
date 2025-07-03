#!/bin/bash

# A simple script for creating a local tunnel for GitHub integration with a local server.
# It simply creates a tunnel to localhost via the public IP address.
# Secondly, it updates the selected GitHub repository's APPLY_ALLOCATOR_BACKEND_URL variable with the new backend URL.
# This helps to automate the process of changing the GitHub action URL for sending issue updates.
# Requirements:
# 1. A Fine-grained Token for the selected repository with permission to update GitHub variables.
# 2. The localtunnel package installed. "npm install -g localtunnel"
# 3. curl installed
# Usage: ./setup-tunnel.sh PORT

if [ -f ".env" ]; then
    source .env
    echo "Loaded environment variables from .env"
else
    echo "Warning: .env file not found"
fi

if [ -z "$1" ]; then
    echo "Error: Port is required. Usage: ./setup-tunnel.sh PORT"
    echo "Example: ./setup-tunnel.sh 3001"
    exit 1
fi

PORT="$1"
temp_file=$(mktemp)

cleanup() {
    echo "Cleaning up..."
    rm -f "$temp_file"
    if [ -n "$tunnel_pid" ]; then
        kill $tunnel_pid 2>/dev/null
        echo "Tunnel process stopped"
    fi
}

trap cleanup EXIT INT TERM ERR QUIT HUP ABRT

set -e

echo "Starting localtunel and GitHub integration on port $PORT..."

npx localtunnel --port "$PORT" > "$temp_file" 2>&1 &
tunnel_pid=$!

echo "Waiting for tunnel URL..."
sleep 5

tunnel_url=$(grep -o 'https://[^[:space:]]*\.loca\.lt' "$temp_file" | head -1)

if [ -z "$tunnel_url" ]; then
    echo "Failed to extract tunnel URL"
    cat "$temp_file"
    exit 1
fi

echo "Updating GitHub variable..."

response=$(curl -L -s -X PATCH \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/$GITHUB_ISSUES_OWNER/$GITHUB_ISSUES_REPO/actions/variables/APPLY_ALLOCATOR_BACKEND_URL" \
    -d "{\"name\":\"APPLY_ALLOCATOR_BACKEND_URL\",\"value\":\"$tunnel_url\"}")

# If variable doesn't exist (404), create it
if echo "$response" | grep -q "Not Found"; then
    echo "Variable doesn't exist, creating new one..."
    response=$(curl -L -s -X POST \
        -H "Accept: application/vnd.github+json" \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "https://api.github.com/repos/$GITHUB_ISSUES_OWNER/$GITHUB_ISSUES_REPO/actions/variables" \
        -d "{\"name\":\"APPLY_ALLOCATOR_BACKEND_URL\",\"value\":\"$tunnel_url\"}")
fi

echo "GitHub variable updated successfully!"
echo "Done! You can now access your app at: $tunnel_url"
echo "Tunnel is running in background with PID: $tunnel_pid"
echo "Press Ctrl+C to stop the tunnel"

wait $tunnel_pid