#!/usr/bin/env bash
#
# Fail if build/ has a Moonraker or G2-Service address compiled in.
#
# A distributable bundle talks to the printer it was loaded from (same origin)
# and contains no address at all. Anything found here works on one printer only,
# and has already reached customers once. Run by CI on every push and before the
# build workflow commits build/.
#
# Usage: check-build.sh [build-dir]

set -Eeuo pipefail

BUILD_DIR="${1:-build}"

if [ ! -f "$BUILD_DIR/index.html" ]; then
	echo "check-build: $BUILD_DIR/index.html not found" >&2
	exit 1
fi

# Vite inlines import.meta.env as an object literal: `VITE_MOONRAKER_HOST:"192.168.1.107"`.
BAKED="$(grep -rhoE 'VITE_(MOONRAKER|G2_SERVICE)_[A-Z_]*:"[^"]+"' "$BUILD_DIR" 2>/dev/null | sort -u || true)"

if [ -n "$BAKED" ]; then
	echo "check-build: $BUILD_DIR has configuration compiled in:" >&2
	printf '    %s\n' $BAKED >&2
	echo "Rebuild without a .env (script/build.sh --no-env) or let CI rebuild main." >&2
	exit 1
fi

echo "check-build: same-origin bundle, no addresses compiled in"
