@echo off
rem Starts TRAMA from source on Windows: checks Node.js, installs once, opens the browser.
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title TRAMA

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  O TRAMA precisa do Node.js 20.19 ou mais novo ^(a versão LTS serve^).
  echo  Vou abrir a página de download. Instale, feche esta janela e abra este arquivo de novo.
  echo.
  start "" "https://nodejs.org/pt-br/download"
  pause
  exit /b 1
)

node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>20||(a===20&&b>=19)?0:1)"
if errorlevel 1 (
  echo.
  echo  Seu Node.js é antigo demais. Instale a versão LTS ^(20.19 ou mais nova^) e tente de novo.
  echo.
  start "" "https://nodejs.org/pt-br/download"
  pause
  exit /b 1
)

node -e "const fs=require('fs');try{process.exit(fs.statSync('node_modules/.package-lock.json').mtimeMs>=fs.statSync('package-lock.json').mtimeMs?0:1)}catch(e){process.exit(1)}"
if errorlevel 1 (
  echo.
  echo  Primeira execução: instalando as dependências ^(de 1 a 3 minutos, precisa de internet^)...
  echo.
  call npm ci --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo  A instalação falhou. Confira a conexão e tente de novo.
    pause
    exit /b 1
  )
)

echo.
echo  Abrindo o TRAMA no navegador. Para encerrar, feche esta janela.
echo.
call npm run dev -- --host localhost --open
pause
