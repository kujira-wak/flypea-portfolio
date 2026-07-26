$ErrorActionPreference = "Stop"

& node (Join-Path $PSScriptRoot "site-manager.mjs") @args
exit $LASTEXITCODE
