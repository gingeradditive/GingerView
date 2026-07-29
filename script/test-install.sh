#!/usr/bin/env bash
#
# Integration test for install.sh, run inside a throwaway Debian container.
#
# Exercises what actually matters for G2OS: that nginx serves the SPA, that
# Moonraker and the Wi-Fi service are proxied on the same origin, that a
# pre-existing Mainsail site is removed, and that re-running changes nothing.
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
cp "$REPO_ROOT/script/install.sh" "$WORK/src/script/"
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

# Mainsail installed alongside, which the installer must dislodge.
mkdir -p /home/pi/mainsail && echo MAINSAIL > /home/pi/mainsail/index.html
mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
printf 'server {\n listen 80 default_server;\n server_name _;\n root /home/pi/mainsail;\n}\n' \
	> /etc/nginx/sites-available/mainsail
ln -sf /etc/nginx/sites-available/mainsail /etc/nginx/sites-enabled/mainsail

# Fake Moonraker (7125) and Wi-Fi service (8000), each echoing the path it got.
python3 - <<'PY' &
import http.server, socketserver, threading
def make(tag):
    class H(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            body = f"{tag}:{self.path}".encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers(); self.wfile.write(body)
        def log_message(self, *a): pass
    return H
for port, tag in ((7125, "MOONRAKER"), (8000, "WIFI")):
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
check "wifi beats /api regex" "WIFI:/api/wifi/status"   "$(curl -sS http://127.0.0.1/api/wifi/status)"
check "moonraker /machine"    "MOONRAKER:/machine/system_info" "$(curl -sS http://127.0.0.1/machine/system_info)"
check "websocket proxied"     "MOONRAKER:/websocket"    "$(curl -sS http://127.0.0.1/websocket)"
check "index not cached"      "no-store"                "$(curl -sSI http://127.0.0.1/ | tr -d '\r')"
check "assets immutable"      "immutable"               "$(curl -sSI http://127.0.0.1/_app/immutable/app.js | tr -d '\r')"

echo
echo "### filesystem"
check "mainsail site gone"    "absent"  "$([ -e /etc/nginx/sites-enabled/mainsail ] && echo present || echo absent)"
check "gingerview enabled"    "present" "$([ -e /etc/nginx/sites-enabled/gingerview ] && echo present || echo absent)"
check "update_manager added"  "[update_manager GingerView]" "$(cat /home/pi/printer_data/config/moonraker.conf)"
check "correct repo path"     "path: /home/pi/GingerView"   "$(cat /home/pi/printer_data/config/moonraker.conf)"
check "no .env written"       "absent"  "$([ -e /home/pi/GingerView/.env ] && echo present || echo absent)"

echo
echo "### idempotence"
bash /home/pi/GingerView/script/install.sh --user pi --no-reload >/dev/null 2>&1
check "second run succeeds"   "0" "$?"
check "no duplicate section"  "1" "$(grep -c '^\[update_manager GingerView\]' /home/pi/printer_data/config/moonraker.conf)"
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
