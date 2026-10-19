# Run Token Color Mapper from venv. Use after setup_venv.ps1
$root = $PSScriptRoot
$venvPython = Join-Path $root "venv\Scripts\python.exe"
if (Test-Path $venvPython) {
    & $venvPython (Join-Path $root "main.py") @args
} else {
    Write-Host "Venv not found. Run .\setup_venv.ps1 first." -ForegroundColor Yellow
    & python (Join-Path $root "main.py") @args
}
