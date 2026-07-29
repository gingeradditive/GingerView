#!/usr/bin/env bash
#
# Build GingerView for production, into build/.
#
# Note that CI already does this on every push to main and commits the result,
# so a normal deploy never needs this script. It is for building locally to test
# a change, or to produce artifacts when CI is unavailable.
#
# Usage: build.sh [options]
#   --ci          Install with `npm ci` (exact lockfile, wipes node_modules)
#   --no-env      Ignore a local .env, producing a same-origin bundle like CI's
#   -h, --help    Show this help

set -Eeuo pipefail

# shellcheck source=script/_common.sh
. "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

USE_CI=0
IGNORE_ENV=0

while [ $# -gt 0 ]; do
	case "$1" in
		--ci)      USE_CI=1; shift ;;
		--no-env)  IGNORE_ENV=1; shift ;;
		-h|--help) awk 'NR < 3 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"; exit 0 ;;
		*)         fail "unknown option: $1 (try --help)" ;;
	esac
done

ROOT="$(repo_root)"
cd "$ROOT"

load_node

# --------------------------------------------------------------------------
# .env decides what ends up baked into the bundle
# --------------------------------------------------------------------------
# VITE_* values are inlined at build time. CI builds without a .env, which is
# what produces the same-origin bundle that works on every printer. Building
# with a local .env bakes in that printer's address instead.

RESTORE_ENV=""
restore_env() {
	if [ -n "$RESTORE_ENV" ] && [ -f "$RESTORE_ENV" ]; then
		mv -f "$RESTORE_ENV" "$ROOT/.env"
	fi
}

if [ -f .env ]; then
	if [ "$IGNORE_ENV" -eq 1 ]; then
		RESTORE_ENV="$(mktemp)"
		mv -f .env "$RESTORE_ENV"
		# Also on a signal: this script must never be the reason a developer's
		# .env goes missing.
		trap restore_env EXIT INT TERM HUP
		info "Ignoring .env for this build (restored on exit)"
	else
		warn ".env is present: its VITE_* values will be compiled into the bundle."
		warn "Do not commit a build/ produced this way — use --no-env for a distributable build."
	fi
fi

# --------------------------------------------------------------------------
# Dependencies
# --------------------------------------------------------------------------

if [ "$USE_CI" -eq 1 ]; then
	[ -f package-lock.json ] || fail "--ci needs package-lock.json"
	info "Installing dependencies with npm ci..."
	npm ci
else
	info "Installing dependencies..."
	npm install
fi

# --------------------------------------------------------------------------
# Build
# --------------------------------------------------------------------------

info "Building..."
rm -rf build
npm run build

[ -f build/index.html ] || fail "build finished but build/index.html is missing"
ok "Build written to $ROOT/build"

# --------------------------------------------------------------------------
# Report what the bundle points at
# --------------------------------------------------------------------------
# A same-origin bundle contains no addresses at all. Anything found here would be
# wrong on every printer except the one it was built for.

BAKED="$(grep -rhoE 'VITE_(MOONRAKER|NETWORK_API)_[A-Z_]*:"[^"]+"' build/_app 2>/dev/null | sort -u || true)"

if [ -n "$BAKED" ]; then
	warn "This bundle has configuration compiled in:"
	printf '%s\n' "$BAKED" | sed 's/^/      /' >&2
	warn "Rebuild with --no-env to produce a bundle that works on any printer."
else
	ok "Same-origin bundle: no addresses compiled in, works on any printer"
fi
