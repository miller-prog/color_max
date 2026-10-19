# Create and populate venv for Token Color Mapper. Run from python-app folder.
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

$venvPath = Join-Path $root "venv"
if (Test-Path $venvPath) {
    Write-Host "Venv already exists at $venvPath" -ForegroundColor Yellow
    $resp = Read-Host "Recreate? (y/N)"
    if ($resp -ne "y" -and $resp -ne "Y") { exit 0 }
    Remove-Item -Recurse -Force $venvPath
}

Write-Host "Creating venv at $venvPath ..." -ForegroundColor Cyan
python -m venv $venvPath
if (-not $?) { throw "python -m venv failed" }

$pip = Join-Path $venvPath "Scripts\pip.exe"
$python = Join-Path $venvPath "Scripts\python.exe"

Write-Host "Upgrading pip ..." -ForegroundColor Cyan
& $python -m pip install --upgrade pip

Write-Host "Installing base requirements ..." -ForegroundColor Cyan
& $pip install -r (Join-Path $root "requirements-base.txt")

Write-Host "Installing PyTorch with CUDA (for GPU) ..." -ForegroundColor Cyan
$urls = @(
    "https://download.pytorch.org/whl/cu128",
    "https://download.pytorch.org/whl/cu126",
    "https://download.pytorch.org/whl/cu124"
)
$done = $false
foreach ($url in $urls) {
    try {
        & $pip install torch torchvision torchaudio --index-url $url
        $done = $true
        Write-Host "PyTorch + CUDA installed from $url" -ForegroundColor Green
        break
    } catch {
        Write-Host "Failed with $url, trying next ..." -ForegroundColor Yellow
    }
}
if (-not $done) {
    Write-Host "Installing PyTorch CPU-only fallback ..." -ForegroundColor Yellow
    & $pip install torch torchvision torchaudio
}

Write-Host "Verifying GPU ..." -ForegroundColor Cyan
& $python -c "import torch; cuda=torch.cuda.is_available(); print('CUDA available:', cuda); print('Device:', torch.cuda.get_device_name(0) if cuda else 'CPU')"
Write-Host "Venv ready. Use: .\venv\Scripts\Activate.ps1 then python main.py" -ForegroundColor Green
Write-Host "Or run: .\run.ps1" -ForegroundColor Green
