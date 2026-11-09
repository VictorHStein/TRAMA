#!/bin/sh
# Starts TRAMA from source on macOS or Linux: checks Node.js, installs once, opens the browser.
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "O TRAMA precisa do Node.js 20.19 ou mais novo (a versão LTS serve)."
  echo "Baixe em https://nodejs.org/pt-br/download, instale e rode este script de novo."
  url="https://nodejs.org/pt-br/download"
  if command -v open >/dev/null 2>&1; then open "$url"; elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$url" >/dev/null 2>&1; fi
  exit 1
fi

if ! node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>20||(a===20&&b>=19)?0:1)"; then
  echo "Seu Node.js ($(node -v)) é antigo demais. Instale a versão LTS (20.19 ou mais nova)."
  exit 1
fi

if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo "Primeira execução: instalando as dependências (de 1 a 3 minutos, precisa de internet)..."
  npm ci --no-audit --no-fund || { echo "A instalação falhou. Confira a conexão e tente de novo."; exit 1; }
fi

echo "Abrindo o TRAMA no navegador. Aperte Ctrl+C para encerrar."
exec npm run dev -- --host localhost --open
