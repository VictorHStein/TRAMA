# Serves the prebuilt TRAMA on http://localhost and opens the browser.
# No Node.js needed: Windows PowerShell 5.1 (built into Windows 10/11) is enough.
# Several worker runspaces share one HttpListener, so a paused video stream never
# blocks the other files. Range requests are supported, so the tutorial video can seek.
#
# Folder served: -Root if given; otherwise "app" next to this script (release zip),
# this script's own folder, or ../dist (repository after `npm run build`).
param([string]$Root = '', [int]$Port = 4173, [switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
if ($Root -ne '') {
  $root = (Resolve-Path $Root).Path
} else {
  $root = $null
  foreach ($c in @((Join-Path $here 'app'), $here, (Join-Path (Split-Path -Parent $here) 'dist'))) {
    if (Test-Path (Join-Path $c 'index.html')) { $root = $c; break }
  }
}
if (-not $root -or -not (Test-Path (Join-Path $root 'index.html'))) {
  Write-Host 'index.html nao encontrado. Rode "npm run build" ou use -Root <pasta>.' -ForegroundColor Red
  exit 1
}

$listener = $null
foreach ($p in $Port..($Port + 20)) {
  $l = New-Object System.Net.HttpListener
  $l.Prefixes.Add("http://localhost:$p/")
  try { $l.Start(); $listener = $l; $Port = $p; break } catch { $l.Close() }
}
if (-not $listener) { Write-Host 'Nenhuma porta livre entre 4173 e 4193.' -ForegroundColor Red; exit 1 }

$worker = {
  param($listener, $root)
  $types = @{
    '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
    '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json; charset=utf-8'; '.md' = 'text/markdown; charset=utf-8'
    '.txt' = 'text/plain; charset=utf-8'; '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'
    '.jpeg' = 'image/jpeg'; '.webp' = 'image/webp'; '.ico' = 'image/x-icon'; '.woff' = 'font/woff'; '.woff2' = 'font/woff2'
    '.ttf' = 'font/ttf'; '.mp4' = 'video/mp4'; '.webm' = 'video/webm'; '.glb' = 'model/gltf-binary'; '.wasm' = 'application/wasm'
  }
  $rootFull = [System.IO.Path]::GetFullPath($root).TrimEnd('\') + '\'
  while ($listener.IsListening) {
    try { $ctx = $listener.GetContext() } catch { break }
    $res = $ctx.Response
    $fs = $null
    try {
      $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
      if ($rel -eq '' -or $rel.EndsWith('/')) { $rel += 'index.html' }
      $full = [System.IO.Path]::GetFullPath((Join-Path $rootFull $rel))
      if (-not $full.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase) -or -not [System.IO.File]::Exists($full)) {
        $res.StatusCode = 404; $res.Close(); continue
      }
      $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
      $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
      $res.Headers['Accept-Ranges'] = 'bytes'
      $res.Headers['Cache-Control'] = 'no-cache'
      $fs = [System.IO.File]::OpenRead($full)
      $len = $fs.Length; $start = 0; $end = $len - 1
      $range = $ctx.Request.Headers['Range']
      if ($range -match '^bytes=(\d*)-(\d*)$') {
        if ($Matches[1] -ne '') { $start = [int64]$Matches[1]; if ($Matches[2] -ne '') { $end = [Math]::Min([int64]$Matches[2], $len - 1) } }
        elseif ($Matches[2] -ne '') { $start = [Math]::Max(0, $len - [int64]$Matches[2]) }
        if ($start -gt $end) {
          $res.StatusCode = 416; $res.Headers['Content-Range'] = "bytes */$len"; $res.Close(); continue
        }
        $res.StatusCode = 206
        $res.Headers['Content-Range'] = "bytes $start-$end/$len"
      }
      $count = $end - $start + 1
      $res.ContentLength64 = $count
      if ($ctx.Request.HttpMethod -ne 'HEAD') {
        [void]$fs.Seek($start, 'Begin')
        $buf = New-Object byte[] 262144
        while ($count -gt 0) {
          $n = $fs.Read($buf, 0, [int][Math]::Min($buf.Length, $count))
          if ($n -le 0) { break }
          $res.OutputStream.Write($buf, 0, $n)
          $count -= $n
        }
      }
      $res.Close()
    } catch {
      # The browser cancelled the request (normal while a video seeks).
      try { $res.Abort() } catch { }
    } finally {
      if ($fs) { $fs.Dispose() }
    }
  }
}

$pool = [RunspaceFactory]::CreateRunspacePool(1, 8)
$pool.Open()
$jobs = foreach ($i in 1..8) {
  $ps = [PowerShell]::Create()
  $ps.RunspacePool = $pool
  [void]$ps.AddScript($worker).AddArgument($listener).AddArgument($root)
  [pscustomobject]@{ PS = $ps; Handle = $ps.BeginInvoke() }
}

$url = "http://localhost:$Port/"
Write-Host ''
Write-Host "  TRAMA rodando em $url" -ForegroundColor Cyan
Write-Host '  Feche esta janela (ou aperte Ctrl+C) para encerrar.'
Write-Host ''

if (-not $NoBrowser) {
  # Voice commands need Chrome or Edge; Edge ships with Windows.
  $chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
              "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
              "$env:LocalAppData\Google\Chrome\Application\chrome.exe") | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  if ($chrome) { Start-Process $chrome $url }
  else { try { Start-Process "microsoft-edge:$url" } catch { Start-Process $url } }
}

try {
  while ($listener.IsListening) { Start-Sleep -Milliseconds 500 }
} finally {
  $listener.Stop(); $listener.Close()
  foreach ($j in $jobs) { $j.PS.Stop(); $j.PS.Dispose() }
  $pool.Close()
}
