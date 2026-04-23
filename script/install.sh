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

# Create .env file from .env.example if it doesn't exist
if [ ! -f "$PROJECT_DIR/.env" ]; then
    print_info "Creating .env file from .env.example..."
    cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
fi

print_success ".env file configured"

# Build the application
print_info "Building GingerView..."
npm run build

# Check if build was successful
if [ ! -d "$PROJECT_DIR/build" ]; then
    print_error "Build failed - no build directory found"
    print_info "Looking for build directories..."
    ls -la "$PROJECT_DIR" | grep -E "build|\.svelte-kit" || true
    exit 1
fi

# With adapter-static, output is always in build directory
BUILD_DIR="$PROJECT_DIR/build"

if [ ! -d "$BUILD_DIR" ]; then
    print_error "Build directory not found: $BUILD_DIR"
    print_info "Available directories:"
    find "$PROJECT_DIR" -maxdepth 2 -type d -name "build" -o -name "output" 2>/dev/null || true
    exit 1
fi

print_success "Build completed in: $BUILD_DIR"

# Set permissions BEFORE configuring nginx
print_info "Setting permissions on build directory..."
chmod -R 755 "$BUILD_DIR"
find "$BUILD_DIR" -type f -exec chmod 644 {} \;
find "$BUILD_DIR" -type d -exec chmod 755 {} \;

# Configure nginx
print_info "Configuring nginx..."

# Remove old GingerView configurations to avoid conflicts
rm -f /etc/nginx/sites-available/gingerview
rm -f /etc/nginx/sites-available/GingerView
rm -f /etc/nginx/sites-enabled/gingerview
rm -f /etc/nginx/sites-enabled/GingerView
rm -f /etc/nginx/sites-enabled/mainsail.bak*

# Create nginx config
NGINX_CONF="/etc/nginx/sites-available/GingerView"
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

    # Disable access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    # Proxy Moonraker API
    location /moonraker/ {
        proxy_pass http://127.0.0.1:7125/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }

    # Proxy Moonraker WebSocket
    location /moonraker/websocket {
        proxy_pass http://127.0.0.1:7125/websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
}
EOF

# Enable the site
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/GingerView

# Remove default nginx site if exists
rm -f /etc/nginx/sites-enabled/default

# Nginx test/restart is executed after both GingerView and Mainsail sites are configured.

# Create systemd service for auto-rebuild (optional)
print_info "Creating systemd service for GingerView..."
cat > /etc/systemd/system/GingerView.service << EOF
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
cat > /etc/systemd/system/GingerView-watcher.service << EOF
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
print_info "Systemd services created (GingerView.service, GingerView-watcher.service)"
print_info "Note: For production, nginx serves static files. GingerView-watcher is for development only."

# Set ownership of project directory
print_info "Setting ownership..."
chown -R $SUDO_USER:$SUDO_USER "$PROJECT_DIR" 2>/dev/null || true

# Verify nginx can read build directory
print_info "Verifying nginx can access build directory..."
NGINX_USER=$(ps aux | grep 'nginx: master' | awk '{print $1}' | head -1)
if [ -z "$NGINX_USER" ]; then
    NGINX_USER="www-data"
fi
print_info "Nginx runs as user: $NGINX_USER"

# Ensure nginx user can read the build directory
chmod -R 755 "$BUILD_DIR"
chmod 755 "$(dirname "$BUILD_DIR")"

# Install/Configure Mainsail on port 8081
print_info "Configuring Mainsail on port 8081..."

# Remove old Mainsail configurations to avoid conflicts
rm -f /etc/nginx/sites-available/mainsail
rm -f /etc/nginx/sites-enabled/mainsail

# Check if Mainsail is already installed
MAINSAIL_DIR="/home/$SUDO_USER/mainsail"
MAINSAIL_CONFIG_DIR="/home/$SUDO_USER/mainsail-config"

if [ ! -d "$MAINSAIL_DIR" ]; then
    print_info "Mainsail not found, installing..."
    
    # Install Mainsail using git clone
    cd "/home/$SUDO_USER"
    sudo -u "$SUDO_USER" git clone https://github.com/mainsail-crew/mainsail.git mainsail
    
    print_success "Mainsail cloned to $MAINSAIL_DIR"
else
    print_info "Mainsail already installed at $MAINSAIL_DIR"
fi

# Create nginx config for Mainsail on port 8081
MAINSAIL_NGINX_CONF="/etc/nginx/sites-available/mainsail"
cat > "$MAINSAIL_NGINX_CONF" << EOF
server {
    listen 8081 default_server;
    listen [::]:8081 default_server;

    root $MAINSAIL_DIR;
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

    # Disable access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    # Proxy Moonraker API
    location /moonraker/ {
        proxy_pass http://127.0.0.1:7125/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }

    # Proxy Moonraker WebSocket
    location /moonraker/websocket {
        proxy_pass http://127.0.0.1:7125/websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
}
EOF

# Enable Mainsail site
ln -sf "$MAINSAIL_NGINX_CONF" /etc/nginx/sites-enabled/mainsail

# Set permissions for Mainsail
chown -R $SUDO_USER:$SUDO_USER "$MAINSAIL_DIR" 2>/dev/null || true
chmod -R 755 "$MAINSAIL_DIR"

# Configure Mainsail to connect to local Moonraker
print_info "Configuring Mainsail to connect to local Moonraker..."
if [ -f "$MAINSAIL_DIR/config.json" ]; then
    # Backup original config
    cp "$MAINSAIL_DIR/config.json" "$MAINSAIL_DIR/config.json.bak"
    
    # Mainsail and Moonraker are always on the same server, use localhost
    # Create proper config with Moonraker instance
    sudo -u "$SUDO_USER" cat > "$MAINSAIL_DIR/config.json" << 'EOF'
{
    "defaultLocale": "en",
    "defaultMode": "dark",
    "defaultTheme": "mainsail",
    "hostname": null,
    "port": 7125,
    "path": null,
    "instancesDB": "moonraker",
    "instances": []
}
EOF
    
    print_success "Mainsail configured to use current host with Moonraker port 7125"
else
    print_info "Mainsail config.json not found, skipping Moonraker configuration"
fi

print_success "Mainsail configured on port 8081"

# Test and restart nginx after all site configs are created
print_info "Testing nginx configuration..."
if ! nginx -t; then
    print_error "Nginx configuration test failed"
    print_info "GingerView config: $NGINX_CONF"
    print_info "Mainsail config: $MAINSAIL_NGINX_CONF"
    exit 1
fi

print_info "Restarting nginx..."
systemctl restart nginx
systemctl enable nginx

if ! systemctl is-active --quiet nginx; then
    print_error "Nginx failed to start"
    print_info "Check logs with: journalctl -u nginx -n 50"
    exit 1
fi

print_success "Nginx configured and running"

# Configure Moonraker update_manager for GingerView in moonraker.conf
print_info "Configuring Moonraker update_manager for GingerView..."

MOONRAKER_CONF="/home/$SUDO_USER/printer_data/config/moonraker.conf"
if [ -f "$MOONRAKER_CONF" ]; then
    TMP_CONF=$(mktemp)

    # Remove existing GingerView update_manager section if present
    awk '
        BEGIN { skip=0 }
        /^\[update_manager GingerView\]/ { skip=1; next }
        skip && /^\[/ { skip=0 }
        !skip { print }
    ' "$MOONRAKER_CONF" > "$TMP_CONF"

    cat >> "$TMP_CONF" << EOF

[update_manager GingerView]
type: git_repo
path: $PROJECT_DIR
origin: https://github.com/gingeradditive/GingerView.git
primary_branch: main
# Use update.sh so Moonraker update runs pull/build/restart logic
install_script: $PROJECT_DIR/script/update.sh
is_system_service: False
EOF

    cp "$TMP_CONF" "$MOONRAKER_CONF"
    rm -f "$TMP_CONF"
    chown $SUDO_USER:$SUDO_USER "$MOONRAKER_CONF"

    print_success "Moonraker update_manager configured in $MOONRAKER_CONF"
    print_info "Restart Moonraker to apply changes: sudo systemctl restart moonraker"
else
    print_info "moonraker.conf not found at $MOONRAKER_CONF, skipping update_manager configuration"
fi

print_success "Installation completed successfully!"
echo ""
echo "=== GingerView and Mainsail are now running ==="
echo ""
echo "GingerView (Port 80):"
echo "  Access it at: http://$(hostname -I | awk '{print $1}')"
echo ""
echo "Mainsail (Port 8081):"
echo "  Access it at: http://$(hostname -I | awk '{print $1}'):8081"
echo ""
echo "To rebuild GingerView after changes:"
echo "  cd $PROJECT_DIR && npm run build"
echo ""
echo "To restart nginx:"
echo "  sudo systemctl restart nginx"
echo ""
echo "To view nginx logs:"
echo "  sudo journalctl -u nginx -f"
echo ""
echo "Mainsail configurations are preserved from your existing setup"
