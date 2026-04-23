#!/bin/bash

# GingerView Update Script for Moonraker Update Manager
# This script handles the update process for GingerView

set -e

# Moonraker package declaration
# This allows Moonraker to detect and manage this update
PKGS="GingerView"
PKG_DISTRO=""
PKG_ARCH=""

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

# Pull latest changes (non-destructive)
print_info "Pulling latest changes from git..."
git fetch origin
git checkout main
git pull --ff-only origin main

# Install dependencies
print_info "Installing npm dependencies..."
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
if ! command -v nvm >/dev/null 2>&1; then
    print_error "nvm not found. Please install nvm and Node.js 20 first."
    exit 1
fi
nvm use 20
npm install

# Build the application
print_info "Building GingerView..."
npm run build

if [ ! -d "$PROJECT_DIR/build" ]; then
    print_error "Build failed: build directory not found"
    exit 1
fi

# Set permissions
print_info "Setting permissions..."
chmod -R 755 build/

# Restart nginx
print_info "Restarting nginx..."
if command -v sudo >/dev/null 2>&1; then
    sudo -n systemctl restart nginx 2>/dev/null || print_info "Cannot restart nginx without passwordless sudo, skipping"
else
    systemctl restart nginx 2>/dev/null || print_info "Cannot restart nginx in current context, skipping"
fi

print_success "GingerView updated successfully!"
