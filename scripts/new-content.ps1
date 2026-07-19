$ErrorActionPreference = "Stop"

$ScriptPath = Join-Path $PSScriptRoot "new-content.mjs"
& node $ScriptPath @args
exit $LASTEXITCODE
