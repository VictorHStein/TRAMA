#!/bin/sh
# Opens the prebuilt TRAMA on macOS or Linux (needs only Python 3).
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then exec python3 servidor-estatico.py "$@"; fi
if command -v python >/dev/null 2>&1; then exec python servidor-estatico.py "$@"; fi
echo "Este atalho precisa do Python 3. No macOS, rode: xcode-select --install"
echo "Outra opção: instale o Node.js (https://nodejs.org) e use o iniciar.sh do código-fonte."
exit 1
