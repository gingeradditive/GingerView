#!/usr/bin/env bash
#
# GingerView installer.
#
# Serves the prebuilt SPA as the machine's default web interface on port 80 and
# proxies Moonraker on the same origin, so that browsers and GingerSlicer reach
# the printer without ever naming a port.
#
# Designed to run unattended inside the G2OS image pipeline: no prompts, no
# reliance on $SUDO_USER, no systemd required, and safe to re-run.
#
# Mainsail is never installed. Any Mainsail nginx site found is disabled, because
# it would otherwise compete for `default_server` on port 80.
#
# Usage: install.sh [options]
#   --src PATH             GingerView checkout (default: parent of this script)
#   --user NAME            Owner of the checkout and of printer_data
#   --port N               Port to serve GingerView on (default: 80)
#   --moonraker-host HOST  Moonraker address (default: 127.0.0.1)
#   --moonraker-port N     Moonraker port (default: 7125)
#   --network-api-host H   Wi-Fi service address (default: 127.0.0.1)
#   --network-api-port N   Wi-Fi service port (default: 8000)
#   --printer-data PATH    printer_data dir (default: ~USER/printer_data)
#   --purge-mainsail       Also delete Mainsail files and its update_manager entry
#   --skip-packages        Do not apt-get install nginx
#   --no-reload            Write configuration but do not reload nginx
#   --print-config         Print the nginx site to stdout and exit (no root needed)
#   -h, --help             Show this help

set -Eeuo pipefail

GINGERVIEW_SRC="${GINGERVIEW_SRC:-}"
GINGERVIEW_USER="${GINGERVIEW_USER:-}"
NGINX_PORT="${NGINX_PORT:-80}"
MOONRAKER_HOST="${MOONRAKER_HOST:-127.0.0.1}"
MOONRAKER_PORT="${MOONRAKER_PORT:-7125}"
NETWORK_API_HOST="${NETWORK_API_HOST:-127.0.0.1}"
NETWORK_API_PORT="${NETWORK_API_PORT:-8000}"
PRINTER_DATA="${PRINTER_DATA:-}"
PURGE_MAINSAIL=0
SKIP_PACKAGES=0
NO_RELOAD=0
PRINT_CONFIG=0

SITE_NAME="gingerview"
COMMON_CONF="/etc/nginx/conf.d/gingerview-common.conf"

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; NC=$'\033[0m'
info()  { echo "${YELLOW}ℹ${NC} $*"; }
ok()    { echo "${GREEN}✓${NC} $*"; }
warn()  { echo "${YELLOW}!${NC} $*" >&2; }
fail()  { echo "${RED}✗${NC} $*" >&2; exit 1; }

trap 'fail "aborted at line $LINENO"' ERR

# Prints the header comment, stopping at the first line that is not a comment.
usage() { awk 'NR < 3 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"; exit 0; }

# --------------------------------------------------------------------------
# Arguments
# --------------------------------------------------------------------------

while [ $# -gt 0 ]; do
	case "$1" in
		--src)              GINGERVIEW_SRC="${2:?--src needs a path}"; shift 2 ;;
		--user)             GINGERVIEW_USER="${2:?--user needs a name}"; shift 2 ;;
		--port)             NGINX_PORT="${2:?--port needs a number}"; shift 2 ;;
		--moonraker-host)   MOONRAKER_HOST="${2:?--moonraker-host needs a host}"; shift 2 ;;
		--moonraker-port)   MOONRAKER_PORT="${2:?--moonraker-port needs a number}"; shift 2 ;;
		--network-api-host) NETWORK_API_HOST="${2:?--network-api-host needs a host}"; shift 2 ;;
		--network-api-port) NETWORK_API_PORT="${2:?--network-api-port needs a number}"; shift 2 ;;
		--printer-data)     PRINTER_DATA="${2:?--printer-data needs a path}"; shift 2 ;;
		--purge-mainsail)   PURGE_MAINSAIL=1; shift ;;
		--skip-packages)    SKIP_PACKAGES=1; shift ;;
		--no-reload)        NO_RELOAD=1; shift ;;
		--print-config)     PRINT_CONFIG=1; shift ;;
		-h|--help)          usage ;;
		*)                  fail "unknown option: $1 (try --help)" ;;
	esac
done

for n in NGINX_PORT MOONRAKER_PORT NETWORK_API_PORT; do
	[[ "${!n}" =~ ^[0-9]+$ ]] && [ "${!n}" -ge 1 ] && [ "${!n}" -le 65535 ] \
		|| fail "$n must be a port number between 1 and 65535, got '${!n}'"
done

# --------------------------------------------------------------------------
# Paths and target user
# --------------------------------------------------------------------------

if [ -z "$GINGERVIEW_SRC" ]; then
	GINGERVIEW_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi
[ -d "$GINGERVIEW_SRC" ] || fail "source directory not found: $GINGERVIEW_SRC"
GINGERVIEW_SRC="$(cd "$GINGERVIEW_SRC" && pwd)"
BUILD_DIR="$GINGERVIEW_SRC/build"

render_site_config() {
	local listen="    listen ${NGINX_PORT} default_server;"
	if [ -f /proc/net/if_inet6 ]; then
		listen+=$'\n'"    listen [::]:${NGINX_PORT} default_server;"
	fi

	cat <<EOF
# Managed by GingerView install.sh — do not edit.
#
# GingerView is the default interface on port ${NGINX_PORT}. Moonraker is proxied on the
# same origin so that neither the browser nor GingerSlicer has to name a port,
# and so that no CORS configuration is required.
#
# Requires the companion map in /etc/nginx/conf.d/gingerview-common.conf, which
# defines \$gingerview_connection_upgrade.

server {
${listen}

    server_name _;

    root ${BUILD_DIR};
    index index.html;

    access_log /var/log/nginx/gingerview-access.log;
    error_log  /var/log/nginx/gingerview-error.log;

    # G-code uploads are large; do not cap them or spool them to disk first.
    client_max_body_size 0;
    proxy_request_buffering off;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 4;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript
               application/json image/svg+xml;

    # --- Moonraker WebSocket ---------------------------------------------
    location /websocket {
        proxy_pass http://${MOONRAKER_HOST}:${MOONRAKER_PORT}/websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$gingerview_connection_upgrade;
        proxy_set_header Host \$http_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Scheme \$scheme;
        proxy_read_timeout 86400;
    }

    # --- Wi-Fi service ----------------------------------------------------
    # '^~' so this wins over the Moonraker regex below, which also matches /api/.
    location ^~ /api/wifi/ {
        proxy_pass http://${NETWORK_API_HOST}:${NETWORK_API_PORT};
        proxy_set_header Host \$http_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Scheme \$scheme;
    }

    # --- Moonraker HTTP API -----------------------------------------------
    # /api/ is Moonraker's OctoPrint-compatible layer, which slicers probe.
    location ~ ^/(printer|api|access|machine|server)/ {
        proxy_pass http://${MOONRAKER_HOST}:${MOONRAKER_PORT}\$request_uri;
        proxy_set_header Host \$http_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Scheme \$scheme;
    }

    # --- Static SPA --------------------------------------------------------
    # Hashed assets are immutable; index.html must never be cached, or an update
    # would keep serving a stale entry point.
    location /_app/immutable/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location = /index.html {
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
EOF
}

if [ "$PRINT_CONFIG" -eq 1 ]; then
	render_site_config
	exit 0
fi

[ "$(id -u)" -eq 0 ] || fail "must run as root"

# The build is committed to the repository by CI, so installing never needs Node.
[ -f "$BUILD_DIR/index.html" ] || fail \
	"no build found at $BUILD_DIR/index.html — pull the latest main (CI commits build/) or run 'npm run build'"

# $SUDO_USER is only a hint: it is unset when the pipeline runs this in a chroot.
if [ -z "$GINGERVIEW_USER" ]; then
	if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
		GINGERVIEW_USER="$SUDO_USER"
	else
		owner="$(stat -c '%U' "$GINGERVIEW_SRC" 2>/dev/null || true)"
		if [ -n "$owner" ] && [ "$owner" != "root" ] && [ "$owner" != "UNKNOWN" ]; then
			GINGERVIEW_USER="$owner"
		else
			GINGERVIEW_USER="$(awk -F: '$3>=1000 && $3<65534 {print $1; exit}' /etc/passwd || true)"
		fi
	fi
fi
[ -n "$GINGERVIEW_USER" ] || fail "could not determine the target user, pass --user"
id "$GINGERVIEW_USER" >/dev/null 2>&1 || fail "user does not exist: $GINGERVIEW_USER"

USER_HOME="$(getent passwd "$GINGERVIEW_USER" | cut -d: -f6)"
[ -n "$PRINTER_DATA" ] || PRINTER_DATA="$USER_HOME/printer_data"
MOONRAKER_CONF="$PRINTER_DATA/config/moonraker.conf"

info "source:       $GINGERVIEW_SRC"
info "web root:     $BUILD_DIR"
info "user:         $GINGERVIEW_USER"
info "listen:       :$NGINX_PORT"
info "moonraker:    $MOONRAKER_HOST:$MOONRAKER_PORT"
info "wifi service: $NETWORK_API_HOST:$NETWORK_API_PORT"

# --------------------------------------------------------------------------
# nginx package
# --------------------------------------------------------------------------

if [ "$SKIP_PACKAGES" -eq 0 ] && ! command -v nginx >/dev/null 2>&1; then
	info "installing nginx..."
	DEBIAN_FRONTEND=noninteractive apt-get update -y
	DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends nginx
fi
command -v nginx >/dev/null 2>&1 || fail "nginx is not installed (drop --skip-packages to install it)"

# --------------------------------------------------------------------------
# Remove Mainsail
# --------------------------------------------------------------------------
# G2OS ships GingerView *instead of* Mainsail. Leaving a Mainsail site enabled
# would collide with our default_server and make nginx refuse to start.

for f in /etc/nginx/sites-enabled/mainsail /etc/nginx/sites-available/mainsail \
         /etc/nginx/conf.d/mainsail.conf; do
	if [ -e "$f" ] || [ -L "$f" ]; then
		rm -f "$f"
		ok "removed Mainsail nginx config: $f"
	fi
done

# Stale configs written by the previous, broken installer.
rm -f /etc/nginx/sites-enabled/GingerView /etc/nginx/sites-available/GingerView \
      /etc/nginx/sites-enabled/default

if [ "$PURGE_MAINSAIL" -eq 1 ]; then
	for d in "$USER_HOME/mainsail" "$USER_HOME/mainsail-config"; do
		if [ -d "$d" ]; then
			rm -rf "$d"
			ok "removed $d"
		fi
	done
elif [ -d "$USER_HOME/mainsail" ]; then
	warn "Mainsail files are still present at $USER_HOME/mainsail (no longer served)."
	warn "Re-run with --purge-mainsail to delete them."
fi

# --------------------------------------------------------------------------
# nginx configuration
# --------------------------------------------------------------------------

# Distro layouts differ: prefer sites-available/enabled when nginx.conf actually
# includes it, otherwise fall back to conf.d, which every layout includes.
if [ -d /etc/nginx/sites-enabled ] && grep -qr 'sites-enabled' /etc/nginx/nginx.conf; then
	SITE_AVAILABLE="/etc/nginx/sites-available/$SITE_NAME"
	SITE_ENABLED="/etc/nginx/sites-enabled/$SITE_NAME"
	mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
else
	SITE_AVAILABLE="/etc/nginx/conf.d/$SITE_NAME.conf"
	SITE_ENABLED=""
	mkdir -p /etc/nginx/conf.d
fi

# `map` lives in the http context. The variable is namespaced because MainsailOS
# images may already define $connection_upgrade in conf.d/common_vars.conf.
mkdir -p "$(dirname "$COMMON_CONF")"
cat > "$COMMON_CONF" <<'EOF'
# Managed by GingerView install.sh — do not edit.
map $http_upgrade $gingerview_connection_upgrade {
    default upgrade;
    ''      close;
}
EOF

render_site_config > "$SITE_AVAILABLE"
[ -n "$SITE_ENABLED" ] && ln -sfn "$SITE_AVAILABLE" "$SITE_ENABLED"
ok "wrote $SITE_AVAILABLE"

# --------------------------------------------------------------------------
# Permissions
# --------------------------------------------------------------------------

chown -R "$GINGERVIEW_USER:$GINGERVIEW_USER" "$GINGERVIEW_SRC" 2>/dev/null || true
find "$BUILD_DIR" -type d -exec chmod 755 {} +
find "$BUILD_DIR" -type f -exec chmod 644 {} +

# nginx must be able to traverse every parent of the web root. Home directories
# are 750 on recent Raspberry Pi OS images, which yields a silent 403.
NGINX_USER="$(awk '$1=="user" {gsub(/;/,"",$2); print $2; exit}' /etc/nginx/nginx.conf 2>/dev/null || true)"
NGINX_USER="${NGINX_USER:-www-data}"

# Permission bits are inspected directly rather than by running `test` as the
# nginx user: root bypasses access checks, and sudo/runuser are not guaranteed to
# exist in an image-build chroot.
other_has() { # other_has <path> <bit: 4=read 1=execute>
	local mode
	mode="$(stat -c '%a' "$1" 2>/dev/null)" || return 1
	[ $(( ${mode: -1} & $2 )) -ne 0 ]
}

dir="$BUILD_DIR"
while :; do
	if ! other_has "$dir" 1; then
		chmod o+x "$dir"
		warn "added o+x to $dir so $NGINX_USER can traverse to the web root"
	fi
	[ "$dir" = "/" ] && break
	dir="$(dirname "$dir")"
done

other_has "$BUILD_DIR/index.html" 4 \
	|| warn "$BUILD_DIR/index.html is not world-readable — expect HTTP 403"

# Deliberately not creating .env: VITE_* values are inlined at build time, so a
# .env written here would have no effect on the already-compiled bundle.

# --------------------------------------------------------------------------
# Validate and reload
# --------------------------------------------------------------------------

if ! nginx -t; then
	echo >&2
	warn "nginx rejected the configuration."
	warn "A 'duplicate default server' error means another site still claims port $NGINX_PORT:"
	warn "  grep -rl default_server /etc/nginx/sites-enabled /etc/nginx/conf.d"
	fail "nginx configuration test failed"
fi
ok "nginx configuration is valid"

if [ "$NO_RELOAD" -eq 1 ]; then
	info "skipping reload (--no-reload)"
elif [ -d /run/systemd/system ]; then
	systemctl enable nginx >/dev/null 2>&1 || true
	systemctl reload nginx 2>/dev/null || systemctl restart nginx
	ok "nginx reloaded"
else
	# Image build chroot: systemd is not running, so leave it to first boot.
	systemctl enable nginx >/dev/null 2>&1 || true
	info "systemd is not running (chroot?), nginx will start on first boot"
fi

# --------------------------------------------------------------------------
# Moonraker update_manager
# --------------------------------------------------------------------------

strip_section() {
	local file="$1" section="$2" tmp
	tmp="$(mktemp)"
	awk -v sec="[$section]" '
		{ line = $0; sub(/[ \t\r]+$/, "", line) }
		line == sec { skip = 1; next }
		skip && line ~ /^\[/ { skip = 0 }
		!skip { print }
	' "$file" > "$tmp"
	cat "$tmp" > "$file"
	rm -f "$tmp"
}

if [ -f "$MOONRAKER_CONF" ]; then
	strip_section "$MOONRAKER_CONF" "update_manager GingerView"
	[ "$PURGE_MAINSAIL" -eq 1 ] && strip_section "$MOONRAKER_CONF" "update_manager mainsail"

	cat >> "$MOONRAKER_CONF" <<EOF

[update_manager GingerView]
type: git_repo
path: $GINGERVIEW_SRC
origin: https://github.com/gingeradditive/GingerView.git
primary_branch: main
is_system_service: False
EOF
	chown "$GINGERVIEW_USER:$GINGERVIEW_USER" "$MOONRAKER_CONF"
	ok "registered GingerView in $MOONRAKER_CONF"
	info "restart Moonraker to pick it up: systemctl restart moonraker"
else
	warn "moonraker.conf not found at $MOONRAKER_CONF — skipped update_manager setup"
fi

# --------------------------------------------------------------------------
# Summary
# --------------------------------------------------------------------------

IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
[ -n "$IP" ] || IP="<printer-ip>"
SUFFIX=""
[ "$NGINX_PORT" != "80" ] && SUFFIX=":$NGINX_PORT"

echo
ok "GingerView installed"
echo
echo "  Interface:  http://${IP}${SUFFIX}"
echo "  Moonraker:  http://${IP}${SUFFIX}/server/info   (same origin, no port)"
echo "  WebSocket:  ws://${IP}${SUFFIX}/websocket"
echo
echo "  In GingerSlicer, add the printer as Klipper/Moonraker with host"
echo "  http://${IP}${SUFFIX} and leave the port empty."
echo
