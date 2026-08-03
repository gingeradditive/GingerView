#!/usr/bin/env bash
#
# Update an installed GingerView.
#
# The compiled bundle is committed to the repository by CI, and nginx serves that
# directory directly, so updating is just a fast-forward pull: no Node, no build
# step, no nginx restart, and no root. This is the same thing Moonraker's
# update_manager does for a git_repo entry.
#
# Usage: update.sh [options]
#   --build           Rebuild locally after pulling, instead of using the
#                     committed build/ (needs Node; for development machines)
#   --reload-nginx    Reload nginx afterwards. Not needed for a static update,
#                     only useful if you also changed its configuration.
#   -h, --help        Show this help

set -Eeuo pipefail

# shellcheck source=script/_common.sh
. "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

DO_BUILD=0
RELOAD_NGINX=0

while [ $# -gt 0 ]; do
	case "$1" in
		--build)        DO_BUILD=1; shift ;;
		--reload-nginx) RELOAD_NGINX=1; shift ;;
		-h|--help)      awk 'NR < 3 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"; exit 0 ;;
		*)              fail "unknown option: $1 (try --help)" ;;
	esac
done

ROOT="$(repo_root)"
cd "$ROOT"

command -v git >/dev/null 2>&1 || fail "git is not installed"
git rev-parse --git-dir >/dev/null 2>&1 || fail "$ROOT is not a git repository"

# --------------------------------------------------------------------------
# Pull
# --------------------------------------------------------------------------
# The old script forced `git checkout main`, which silently threw away whatever
# you had checked out. Update the branch you are actually on, and stop if there
# is anything uncommitted rather than risk overwriting it.

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$BRANCH" != "HEAD" ] || fail "detached HEAD: check out a branch before updating"

if [ -n "$(git status --porcelain)" ]; then
	warn "Uncommitted changes in $ROOT:"
	git status --short | sed 's/^/      /' >&2
	fail "commit or stash them first — refusing to touch a dirty working tree"
fi

info "Updating branch '$BRANCH'..."
git fetch --quiet origin "$BRANCH" || fail "could not fetch origin/$BRANCH"

BEFORE="$(git rev-parse HEAD)"
git merge --ff-only "origin/$BRANCH" >/dev/null || fail \
	"'$BRANCH' cannot be fast-forwarded to origin/$BRANCH — it has diverged, resolve it by hand"
AFTER="$(git rev-parse HEAD)"

if [ "$BEFORE" = "$AFTER" ]; then
	ok "Already up to date ($(git rev-parse --short HEAD))"
else
	ok "Updated $(git rev-parse --short "$BEFORE") → $(git rev-parse --short "$AFTER")"
	git --no-pager log --oneline "$BEFORE..$AFTER" | sed 's/^/      /'
fi

# --------------------------------------------------------------------------
# Bundle
# --------------------------------------------------------------------------

if [ "$DO_BUILD" -eq 1 ]; then
	info "Rebuilding locally..."
	"$ROOT/script/build.sh"
fi

[ -f build/index.html ] || fail \
	"build/index.html is missing. CI commits build/ on pushes to main; if this branch has no
   artifacts, re-run with --build or merge main."

# Newly pulled files inherit the umask, so re-assert what nginx needs to read.
find build -type d -exec chmod 755 {} +
find build -type f -exec chmod 644 {} +

# --------------------------------------------------------------------------
# nginx
# --------------------------------------------------------------------------
# Static files are served straight from disk and index.html is sent with
# no-store, so a plain content update needs nothing here.

if [ "$RELOAD_NGINX" -eq 1 ]; then
	if [ "$(id -u)" -eq 0 ]; then
		nginx -t && systemctl reload nginx && ok "nginx reloaded"
	elif command -v sudo >/dev/null 2>&1; then
		sudo nginx -t && sudo systemctl reload nginx && ok "nginx reloaded"
	else
		warn "cannot reload nginx without root"
	fi
fi

echo
ok "GingerView is up to date"
