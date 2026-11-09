#!/bin/sh
# Double-click on macOS: opens Terminal and runs iniciar.sh (through sh, so only this file needs +x).
exec sh "$(dirname "$0")/iniciar.sh"
