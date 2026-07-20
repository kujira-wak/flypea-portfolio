$ErrorActionPreference = "Stop"
& node (Join-Path $PSScriptRoot "content-manager.mjs") @args
exit $LASTEXITCODE
