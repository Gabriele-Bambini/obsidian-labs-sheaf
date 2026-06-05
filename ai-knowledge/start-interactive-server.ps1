$ErrorActionPreference = "Stop"

$Port = 8765
$NodeCandidates = @(
  "C:\Users\02gab\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe",
  "C:\Users\Gabriele\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe",
  "C:\Program Files\nodejs\node.exe"
)
$Node = $NodeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $Node) {
  $Node = (Get-Command node -ErrorAction Stop).Source
}
$Server = Join-Path $PSScriptRoot "serve-interactive.js"

$existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
  Write-Output "Interactive lab server already listening on http://127.0.0.1:$Port/"
  exit 0
}

Start-Process -FilePath $Node -ArgumentList @("`"$Server`"", "--port", "$Port") -WindowStyle Hidden
Start-Sleep -Seconds 1
Write-Output "Interactive lab server started on http://127.0.0.1:$Port/"
