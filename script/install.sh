#!/bin/bash

# GingerView Installation Script for Raspberry Pi
# This script installs and configures GingerView to replace Mainsail
# Serves the application on port 80 using nginx

set -e

echo "=== GingerView Installation Script ==="
echo "Installing GingerView on Raspberry Pi..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (sudo)"
    exit 1
fi

# Check if running on Raspberry Pi
if [ ! -f /proc/device-tree/model ] || ! grep -q "Raspberry Pi" /proc/device-tree/model 2>/dev/null; then
    print_info "Warning: This script is designed for Raspberry Pi"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

print_info "Project directory: $PROJECT_DIR"

# Update system packages
print_info "Updating system packages..."
apt-get update -y

# Install required packages
print_info "Installing required packages..."
apt-get install -y nginx curl build-essential python3

# Install Node.js 20.x LTS
print_info "Installing Node.js 20.x LTS..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    print_success "Node.js $(node -v) installed"
else
    print_info "Node.js $(node -v) already installed"
fi

# Verify npm installation
if ! command -v npm &> /dev/null; then
    print_error "npm not found after Node.js installation"
    exit 1
fi
print_success "npm $(npm -v) installed"

# Install npm dependencies
print_info "Installing npm dependencies..."
cd "$PROJECT_DIR"
npm install

# Build the application
print_info "Building GingerView..."
npm run build

# Check if build was successful
if [ ! -d "$PROJECT_DIR/build" ] && [ ! -d "$PROJECT_DIR/.svelte-kit/output" ]; then
    print_error "Build failed - no output directory found"
    exit 1
fi

# Determine build directory
BUILD_DIR="$PROJECT_DIR/build"
if [ ! -d "$BUILD_DIR" ]; then
    BUILD_DIR="$PROJECT_DIR/.svelte-kit/output"
fi
print_success "Build completed in: $BUILD_DIR"

# Configure nginx
print_info "Configuring nginx..."

# Create nginx config
NGINX_CONF="/etc/nginx/sites-available/gingerview"
cat > "$NGINX_CONF" << EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root $BUILD_DIR;
    index index.html;

    server_name _;

    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;

    # Handle client routing
    location / {
        try_files \$uri \$uri.html \$uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
EOF

# Enable the site
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/gingerview

# Remove default nginx site if exists
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
print_info "Testing nginx configuration..."
nginx -t

# Restart nginx
print_info "Restarting nginx..."
systemctl restart nginx
systemctl enable nginx

print_success "Nginx configured and running on port 80"

# Create systemd service for auto-rebuild (optional)
print_info "Creating systemd service for GingerView..."
cat > /etc/systemd/system/gingerview.service << EOF
[Unit]
Description=GingerView Auto-Rebuild Service
After=network.target

[Service]
Type=oneshot
User=root
WorkingDirectory=$PROJECT_DIR
ExecStart=/usr/bin/npm run build
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

# Create a simple watcher service that rebuilds on file changes
cat > /etc/systemd/system/gingerview-watcher.service << EOF
[Unit]
Description=GingerView File Watcher
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$PROJECT_DIR
ExecStart=/usr/bin/npm run dev -- --host 0.0.0.0 --port 3000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Note: For production, we use static files served by nginx
# The watcher service is optional for development
print_info "Systemd services created (gingerview.service, gingerview-watcher.service)"
print_info "Note: For production, nginx serves static files. gingerview-watcher is for development only."

# Set permissions
print_info "Setting permissions..."
chown -R $SUDO_USER:$SUDO_USER "$PROJECT_DIR" 2>/dev/null || true
chmod -R 755 "$BUILD_DIR"

print_success "Installation completed successfully!"
echo ""
echo "=== GingerView is now running ==="
echo "Access it at: http://$(hostname -I | awk '{print $1}')"
echo ""
echo "To rebuild the application after changes:"
echo "  cd $PROJECT_DIR && npm run build"
echo ""
echo "To restart nginx:"
echo "  sudo systemctl restart nginx"
echo ""
echo "To view nginx logs:"
echo "  sudo journalctl -u nginx -f"
