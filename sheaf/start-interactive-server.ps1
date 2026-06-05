param(
  [int]$Port = 8766
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Server = Join-Path $ScriptDir "serve-interactive.js"

if (-not (Test-Path -LiteralPath $Server)) {
  throw "Missing server script: $Server"
}

Set-Location -LiteralPath $ScriptDir
node $Server --port $Port
