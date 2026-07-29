#!/usr/bin/env bash
#
# Convenience entry point kept at the repository root, so `./rundev.sh` still
# works. The implementation lives in script/rundev.sh with the other scripts —
# this is a forwarder so the two can never drift apart again.

exec "$(dirname "${BASH_SOURCE[0]}")/script/rundev.sh" "$@"
