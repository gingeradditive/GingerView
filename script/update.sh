#!/bin/bash

# GingerView Update Script for Moonraker Update Manager
# This script handles the update process for GingerView

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

print_info "Updating GingerView..."
print_info "Project directory: $PROJECT_DIR"

cd "$PROJECT_DIR"

# Pull latest changes
print_info "Pulling latest changes from git..."
git fetch origin
git reset --hard origin/main

# Install dependencies
print_info "Installing npm dependencies..."
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20
npm install

# Build the application
print_info "Building GingerView..."
npm run build

# Set permissions
print_info "Setting permissions..."
chmod -R 755 build/

# Restart nginx
print_info "Restarting nginx..."
sudo systemctl restart nginx

print_success "GingerView updated successfully!"
