# Shared helpers for the GingerView scripts. Sourced, never executed.
#
# install.sh deliberately does NOT use this file: it has to run standalone in the
# G2-OS image pipeline, where it may be invoked far from its siblings.

# shellcheck shell=bash

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; NC=$'\033[0m'
info() { echo "${YELLOW}ℹ${NC} $*"; }
ok()   { echo "${GREEN}✓${NC} $*"; }
warn() { echo "${YELLOW}!${NC} $*" >&2; }
fail() { echo "${RED}✗${NC} $*" >&2; exit 1; }

# Absolute path of the repository root, i.e. the parent of script/.
repo_root() {
	cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd
}

# Ask a yes/no question. Accepts both Italian and English answers.
# Usage: confirm "Question? (s/N)" [y|n]   — the second argument is the default
# used for an empty answer and when there is no terminal to ask on.
confirm() {
	local prompt="$1" default="${2:-n}" reply=""

	if [ ! -t 0 ]; then
		[ "$default" = "y" ]
		return
	fi

	read -r -p "$prompt " reply || reply=""
	[ -z "$reply" ] && reply="$default"

	case "$(printf '%s' "$reply" | tr '[:upper:]' '[:lower:]')" in
		s|si|sì|y|yes) return 0 ;;
		*)             return 1 ;;
	esac
}

# Make the Node version declared in .nvmrc active, installing it via nvm if
# needed. Must be called with the repository root as working directory, because
# `nvm use` without arguments is what reads .nvmrc.
load_node() {
	local want have

	export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
	if [ -s "$NVM_DIR/nvm.sh" ]; then
		# shellcheck disable=SC1091
		. "$NVM_DIR/nvm.sh"
		nvm use >/dev/null 2>&1 || {
			info "Installing Node $(tr -d '[:space:]v' < .nvmrc) via nvm..."
			nvm install >/dev/null || fail "nvm could not install the version in .nvmrc"
			nvm use >/dev/null
		}
	fi

	command -v node >/dev/null 2>&1 || fail \
		"Node.js not found. Install nvm (https://github.com/nvm-sh/nvm) or Node $(tr -d '[:space:]v' < .nvmrc)."

	want="$(tr -d '[:space:]v' < .nvmrc | cut -d. -f1)"
	have="$(node -v | sed 's/^v//' | cut -d. -f1)"
	if [ "$want" != "$have" ]; then
		warn "Node $have in use, but .nvmrc asks for $want. Continuing, but the build may differ from CI."
	fi
	ok "Node $(node -v)"
}
