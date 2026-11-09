#!/bin/sh
# Double-click on macOS: opens Terminal and runs abrir.sh (through sh, so only this file needs +x).
exec sh "$(dirname "$0")/abrir.sh" "$@"
