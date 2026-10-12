#!/usr/bin/env bash
#
# Run the GingerView development server.
#
# Uses the Node version from .nvmrc and asks whether to reinstall dependencies
# before starting. Any extra arguments are passed through to Vite, so
# `rundev.sh --host` exposes the dev server on the LAN — handy for opening it on
# a phone, which is the real target device.
#
# Usage: rundev.sh [options] [-- vite args]
#   --install       Reinstall dependencies without asking
#   --no-install    Skip the question and start straight away
#   -h, --help      Show this help

set -Eeuo pipefail

# shellcheck source=script/_common.sh
. "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

FORCE_INSTALL=""

while [ $# -gt 0 ]; do
	case "$1" in
		--install)    FORCE_INSTALL=yes; shift ;;
		--no-install) FORCE_INSTALL=no; shift ;;
		-h|--help)    awk 'NR < 3 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"; exit 0 ;;
		--)           shift; break ;;
		*)            break ;;
	esac
done

ROOT="$(repo_root)"
cd "$ROOT"

load_node

# --------------------------------------------------------------------------
# Dependencies
# --------------------------------------------------------------------------

should_install() {
	# Nothing installed yet: not a question, it simply has to happen.
	if [ ! -d node_modules ]; then
		info "node_modules is missing"
		return 0
	fi

	case "$FORCE_INSTALL" in
		yes) return 0 ;;
		no)  return 1 ;;
	esac

	# A lockfile newer than the last install usually means someone pulled a change
	# to the dependencies, so default to yes in that case and no otherwise.
	# npm 7+ keeps node_modules/.package-lock.json in sync with each install,
	# which is a better marker than the directory mtime: that also moves for
	# unrelated writes. Note this only picks the default answer — you are still
	# asked — so the one-second granularity of `-nt` in bash 3.2 does not matter.
	local installed="node_modules/.package-lock.json"
	[ -f "$installed" ] || installed="node_modules"

	if [ package-lock.json -nt "$installed" ]; then
		warn "package-lock.json is newer than node_modules — dependencies probably changed"
		confirm "Reinstall dependencies? (S/n)" y
	else
		confirm "Reinstall dependencies? (s/N)" n
	fi
}

if should_install; then
	info "Installing dependencies..."
	npm install
	# Keep the mtime comparison above meaningful on the next run.
	touch node_modules
fi

# --------------------------------------------------------------------------
# Dev server
# --------------------------------------------------------------------------

# Which printer the dev server talks to. GINGERVIEW_PRINTER is the normal way
# (vite.config.ts proxies the API to it, same-origin like nginx); VITE_* overrides
# are the cross-origin alternative.
env_value() {
	# `|| true`: a missing key is an empty answer, not a reason for `set -e` to quit.
	{ grep -hsE "^[[:space:]]*$1=" .env.development.local .env 2>/dev/null || true; } |
		tail -n 1 | cut -d= -f2-
}

PRINTER="${GINGERVIEW_PRINTER:-$(env_value GINGERVIEW_PRINTER)}"
DIRECT_HOST="$(env_value VITE_MOONRAKER_HOST)"

if [ -f .env ]; then
	warn "A .env is read by \`vite build\` too: move its settings to .env.development.local."
fi

if [ -n "$PRINTER" ]; then
	info "Proxying the printer API to $PRINTER (same-origin, like nginx)"
elif [ -n "$DIRECT_HOST" ]; then
	info "Calling Moonraker directly at $DIRECT_HOST (needs cors_domains on the printer)"
else
	warn "No printer configured: the app will talk to the Vite server and get no data."
	warn "Copy .env.example to .env.development.local and set GINGERVIEW_PRINTER."
fi

info "Starting Vite..."
exec npm run dev -- "$@"
