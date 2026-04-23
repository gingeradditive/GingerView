#!/bin/bash

# GingerView Build Script
# This script ensures Node.js 20 is used and builds the application

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

print_info "Building GingerView..."
print_info "Project directory: $PROJECT_DIR"

cd "$PROJECT_DIR"

# Check for nvm and Node.js 20
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

if ! command -v nvm >/dev/null 2>&1; then
    print_error "nvm not found. Please install nvm first:"
    echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
    exit 1
fi

# Use Node.js 20
print_info "Switching to Node.js 20..."
nvm use 20

# Verify Node version
NODE_VERSION=$(node -v)
print_success "Using Node.js $NODE_VERSION"

# Install dependencies
print_info "Installing npm dependencies..."
npm install

# Build the application
print_info "Building GingerView..."
npm run build

# Check if build was successful
if [ ! -d "$PROJECT_DIR/build" ]; then
    print_error "Build failed - no build directory found"
    exit 1
fi

print_success "Build completed successfully!"
print_info "Build directory: $PROJECT_DIR/build"
