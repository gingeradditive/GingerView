#!/usr/bin/env bash
#
# Keeps nginx's list of on-link IPv6 prefixes in step with the network.
#
# Moonraker trusts private IPv4 ranges, but on a network with a global IPv6
# prefix (most ISPs now) clients prefer the AAAA record of g2.local and reach
# nginx from a public address. Moonraker then answers 401 to GingerView in a
# browser and to GingerSlicer's upload. A global prefix is assigned by the ISP
# and changes, so it cannot be written into trusted_clients once and for all.
#
# Instead, this writes every prefix the printer is directly attached to into a
# `geo` include, and nginx tells Moonraker that clients from those prefixes are
# local. That is the same trust the private IPv4 ranges get: being on the
# printer's LAN, not merely having an IPv6 address.
#
# Usage: lan-prefixes.sh [--once] [output]
#   --once   Write the file and exit instead of following route changes
#   output   Defaults to /etc/nginx/gingerview/lan-prefixes.conf

set -uo pipefail

ONCE=0
if [ "${1:-}" = "--once" ]; then
	ONCE=1
	shift
fi
OUT="${1:-/etc/nginx/gingerview/lan-prefixes.conf}"

# On-link prefixes are the routes with no gateway. Link-local is left out:
# fe80::/10 is already in Moonraker's trusted_clients.
on_link_prefixes() {
	ip -6 route show table main 2>/dev/null | awk '
		$1 ~ /\// && $1 !~ /^fe80:/ && $0 !~ / via / { print $1 " 1;" }
	' | sort -u
}

sync_prefixes() {
	local tmp
	tmp="$(mktemp)" || return
	{
		echo "# Managed by GingerView lan-prefixes.sh — do not edit."
		on_link_prefixes
	} > "$tmp"

	if cmp -s "$tmp" "$OUT"; then
		rm -f "$tmp"
		return
	fi

	install -m 644 "$tmp" "$OUT"
	rm -f "$tmp"
	echo "on-link prefixes: $(grep -vc '^#' "$OUT")"

	# A config nginx rejects is left on disk but never loaded, so a bad write
	# cannot take the interface down.
	if command -v systemctl >/dev/null 2>&1 && systemctl is-active -q nginx \
		&& nginx -t -q 2>/dev/null; then
		systemctl reload nginx
	fi
}

mkdir -p "$(dirname "$OUT")"
sync_prefixes
[ "$ONCE" -eq 1 ] && exit 0

# Router advertisements come and go in bursts; wait for a quiet second before
# rewriting, rather than reloading nginx once per event.
ip -6 monitor route | while read -r _; do
	while read -r -t 1 _; do :; done
	sync_prefixes
done
