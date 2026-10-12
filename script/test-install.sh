#!/usr/bin/env bash
#
# Integration test for install.sh, run inside a throwaway Debian container.
#
# Exercises what actually matters: that nginx serves the SPA, that Moonraker is
# proxied on the same origin, that a location dropped into g2-locations.d is
# included and wins over the Moonraker regex, that clients on an on-link prefix
# reach Moonraker as trusted while others keep their address, that a Mainsail
# site squatting on our port is disabled while one on another port survives,
# and that re-running changes nothing.
#
# Requires Docker. Usage: script/test-install.sh

set -euo pipefail

IMAGE="${IMAGE:-debian:bookworm-slim}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

command -v docker >/dev/null 2>&1 || { echo "docker is required" >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo "docker is not running" >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# A minimal stand-in for the committed build/, so the test never depends on a
# real build being present in the working tree.
mkdir -p "$WORK/src/script" "$WORK/src/build/_app/immutable" "$WORK/src/printer_data/config"
cp "$REPO_ROOT/script/install.sh" "$REPO_ROOT/script/lan-prefixes.sh" "$WORK/src/script/"
printf '<!doctype html><title>GingerView</title><h1>GINGERVIEW_INDEX</h1>' > "$WORK/src/build/index.html"
printf 'console.log("asset");' > "$WORK/src/build/_app/immutable/app.js"
printf '[server]\nhost: 0.0.0.0\n\n[update_manager mainsail]\ntype: web\n\n[authorization]\ncors_domains:\n    http://*.local\n' \
	> "$WORK/src/printer_data/config/moonraker.conf"

cat > "$WORK/run.sh" <<'INNER'
set -uo pipefail

PASS=0; FAIL=0
check() { # check <name> <expected-substring> <actual>
	if [[ "$3" == *"$2"* ]]; then
		echo "  PASS  $1"; PASS=$((PASS+1))
	else
		echo "  FAIL  $1"; echo "        expected: '$2'"; echo "        actual:   '${3:0:200}'"; FAIL=$((FAIL+1))
	fi
}

useradd -m -u 1000 pi 2>/dev/null || true
mkdir -p /home/pi/GingerView /home/pi/printer_data/config
cp -r /fixture/src/. /home/pi/GingerView/
cp /fixture/src/printer_data/config/moonraker.conf /home/pi/printer_data/config/
chown -R pi:pi /home/pi
# Recent Raspberry Pi OS images ship 750 homes; that is the classic silent 403.
chmod 750 /home/pi

# Two Mainsail sites: one squatting on port 80, which must be disabled, and one
# on 8081, which must survive — a development machine legitimately keeps that.
mkdir -p /home/pi/mainsail && echo MAINSAIL > /home/pi/mainsail/index.html
mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
printf 'server {\n listen 80 default_server;\n server_name _;\n root /home/pi/mainsail;\n}\n' \
	> /etc/nginx/sites-available/mainsail
ln -sf /etc/nginx/sites-available/mainsail /etc/nginx/sites-enabled/mainsail
printf 'server {\n listen 8081 default_server;\n server_name _;\n root /home/pi/mainsail;\n}\n' \
	> /etc/nginx/sites-available/mainsail-8081
ln -sf /etc/nginx/sites-available/mainsail-8081 /etc/nginx/sites-enabled/mainsail-8081

# G2-Service's own nginx location, dropped where its installer puts it. Having it
# there before install.sh runs is what proves the include is honoured.
mkdir -p /etc/nginx/g2-locations.d
printf 'location ^~ /service/ {\n    proxy_pass http://127.0.0.1:8000;\n}\n' \
	> /etc/nginx/g2-locations.d/g2-service.conf

# Fake Moonraker (7125) and G2-Service (8000), each echoing the path it got and
# the client address nginx forwarded.
python3 - <<'PY' &
import http.server, socketserver, threading
def make(tag):
    class H(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            real = self.headers.get("X-Real-IP")
            xff = self.headers.get("X-Forwarded-For")
            body = f"{tag}:{self.path} real={real} xff={xff}".encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers(); self.wfile.write(body)
        def log_message(self, *a): pass
    return H
for port, tag in ((7125, "MOONRAKER"), (8000, "G2SERVICE")):
    srv = socketserver.TCPServer(("127.0.0.1", port), make(tag))
    srv.allow_reuse_address = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
threading.Event().wait()
PY
sleep 2

echo "### install.sh"
bash /home/pi/GingerView/script/install.sh --user pi --no-reload || { echo "INSTALL FAILED"; exit 1; }
nginx -g 'daemon off;' & sleep 2

echo
echo "### HTTP"
check "index served"          "GINGERVIEW_INDEX"        "$(curl -sS http://127.0.0.1/)"
check "SPA fallback"          "GINGERVIEW_INDEX"        "$(curl -sS http://127.0.0.1/settings/network)"
check "static asset"          "asset"                   "$(curl -sS http://127.0.0.1/_app/immutable/app.js)"
check "moonraker /server"     "MOONRAKER:/server/info"  "$(curl -sS http://127.0.0.1/server/info)"
check "moonraker /printer"    "MOONRAKER:/printer/info" "$(curl -sS http://127.0.0.1/printer/info)"
check "query string kept"     "MOONRAKER:/printer/objects/query?print_stats" "$(curl -sS 'http://127.0.0.1/printer/objects/query?print_stats')"
check "octoprint /api"        "MOONRAKER:/api/version"  "$(curl -sS http://127.0.0.1/api/version)"
check "g2-service /service"   "G2SERVICE:/service/health" "$(curl -sS http://127.0.0.1/service/health)"
check "moonraker /machine"    "MOONRAKER:/machine/system_info" "$(curl -sS http://127.0.0.1/machine/system_info)"
check "websocket proxied"     "MOONRAKER:/websocket"    "$(curl -sS http://127.0.0.1/websocket)"
check "index not cached"      "no-store"                "$(curl -sSI http://127.0.0.1/ | tr -d '\r')"
check "assets immutable"      "immutable"               "$(curl -sSI http://127.0.0.1/_app/immutable/app.js | tr -d '\r')"

echo
echo "### on-link prefixes"
# 127.0.0.2 stands in for a LAN client: any 127/8 source reaches nginx on Linux.
check "stranger keeps its ip" "real=127.0.0.2 "         "$(curl -sS --interface 127.0.0.2 http://127.0.0.1/server/info)"
echo '127.0.0.2/32 1;' >> /etc/nginx/gingerview/lan-prefixes.conf
nginx -s reload 2>/dev/null; sleep 1
check "on-link is loopback"   "real=127.0.0.1 xff=127.0.0.2" "$(curl -sS --interface 127.0.0.2 http://127.0.0.1/server/info)"
check "websocket on-link too" "real=127.0.0.1 "         "$(curl -sS --interface 127.0.0.2 http://127.0.0.1/websocket)"

# lan-prefixes.sh against a canned routing table: only gateway-less, non
# link-local routes are on-link.
mkdir -p /tmp/fakebin
cat > /tmp/fakebin/ip <<'IP'
#!/bin/sh
cat <<'R'
2a01:e11:1026:520::/64 dev eth0 proto ra metric 100 pref medium
fd12:3456:789a::/64 dev wlan0 proto ra metric 600 pref medium
fe80::/64 dev eth0 proto kernel metric 1024 pref medium
2001:db8:ffff::/48 via fe80::1 dev eth0 proto static metric 100 pref medium
default via fe80::1 dev eth0 proto ra metric 100 pref medium
R
IP
chmod +x /tmp/fakebin/ip
PATH=/tmp/fakebin:$PATH bash /home/pi/GingerView/script/lan-prefixes.sh --once /tmp/prefixes.conf >/dev/null
check "global prefix kept"    "2a01:e11:1026:520::/64 1;" "$(cat /tmp/prefixes.conf)"
check "ula prefix kept"       "fd12:3456:789a::/64 1;"    "$(cat /tmp/prefixes.conf)"
check "routed/link-local out" "2"                         "$(grep -vc '^#' /tmp/prefixes.conf)"

echo
echo "### filesystem"
check "mainsail :80 disabled" "absent"  "$([ -e /etc/nginx/sites-enabled/mainsail ] && echo present || echo absent)"
check "mainsail :8081 kept"   "present" "$([ -e /etc/nginx/sites-enabled/mainsail-8081 ] && echo present || echo absent)"
check "mainsail :8081 serves" "MAINSAIL" "$(curl -sS http://127.0.0.1:8081/)"
check "available/ untouched"  "present" "$([ -e /etc/nginx/sites-available/mainsail ] && echo present || echo absent)"
check "gingerview enabled"    "present" "$([ -e /etc/nginx/sites-enabled/gingerview ] && echo present || echo absent)"
check "update_manager added"  "[update_manager GingerView]" "$(cat /home/pi/printer_data/config/moonraker.conf)"
check "correct repo path"     "path: /home/pi/GingerView"   "$(cat /home/pi/printer_data/config/moonraker.conf)"
check "no .env written"       "absent"  "$([ -e /home/pi/GingerView/.env ] && echo present || echo absent)"
check "locations dir created" "present" "$([ -d /etc/nginx/g2-locations.d ] && echo present || echo absent)"
check "prefix service unit"   "lan-prefixes.sh /etc/nginx/gingerview/lan-prefixes.conf" "$(cat /etc/systemd/system/gingerview-lan-prefixes.service 2>&1)"

# The site has to work on a machine where no other service is installed: an
# include whose wildcard matches nothing is not an error for nginx.
rm -f /etc/nginx/g2-locations.d/g2-service.conf
if nginx -t 2>&1 | grep -q successful; then echo "  PASS  valid with no G2-Service"; PASS=$((PASS+1));
else echo "  FAIL  empty g2-locations.d breaks the site"; FAIL=$((FAIL+1)); fi

echo
echo "### idempotence"
bash /home/pi/GingerView/script/install.sh --user pi --no-reload >/dev/null 2>&1
check "second run succeeds"   "0" "$?"
check "no duplicate section"  "1" "$(grep -c '^\[update_manager GingerView\]' /home/pi/printer_data/config/moonraker.conf)"
check "prefixes not reset"    "127.0.0.2/32 1;" "$(cat /etc/nginx/gingerview/lan-prefixes.conf)"
if nginx -t 2>&1 | grep -q successful; then echo "  PASS  config still valid"; PASS=$((PASS+1));
else echo "  FAIL  config no longer valid"; FAIL=$((FAIL+1)); fi

echo
echo "### --purge-mainsail"
bash /home/pi/GingerView/script/install.sh --user pi --no-reload --purge-mainsail >/dev/null 2>&1
check "mainsail dir removed"  "absent" "$([ -d /home/pi/mainsail ] && echo present || echo absent)"
check "mainsail um removed"   "0" "$(grep -c '^\[update_manager mainsail\]' /home/pi/printer_data/config/moonraker.conf)"

echo
echo "======================================"
echo "  PASS: $PASS    FAIL: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
INNER

echo "Running install.sh integration test in $IMAGE ..."
docker run --rm -v "$WORK":/fixture:ro "$IMAGE" bash -c '
	export DEBIAN_FRONTEND=noninteractive
	apt-get update -qq >/dev/null 2>&1
	apt-get install -y -qq --no-install-recommends nginx curl python3 >/dev/null 2>&1
	bash /fixture/run.sh
'
