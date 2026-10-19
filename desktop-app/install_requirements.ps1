# Install base requirements then PyTorch 2.9.1 with CUDA for RTX 5060
$ErrorActionPreference = "Stop"
Write-Host "Installing base requirements..." -ForegroundColor Cyan
pip install -r requirements.txt
Write-Host "Installing PyTorch 2.9.1 with CUDA (for RTX 5060)..." -ForegroundColor Cyan
# Prefer cu128 for RTX 50 series (sm_120); then cu126, cu124, cu121
$urls = @(
    "https://download.pytorch.org/whl/cu128",
    "https://download.pytorch.org/whl/cu126",
    "https://download.pytorch.org/whl/cu124",
    "https://download.pytorch.org/whl/cu121"
)
$done = $false
foreach ($url in $urls) {
    try {
        pip install torch==2.9.1 torchvision==0.24.1 torchaudio==2.9.1 --index-url $url
        $done = $true
        Write-Host "PyTorch installed with CUDA from $url" -ForegroundColor Green
        break
    } catch {
        Write-Host "Failed with $url, trying next..." -ForegroundColor Yellow
    }
}
if (-not $done) {
    Write-Host "Falling back to CPU-only PyTorch..." -ForegroundColor Yellow
    pip install torch==2.9.1 torchvision==0.24.1 torchaudio==2.9.1
}
Write-Host "Verifying GPU..." -ForegroundColor Cyan
python -c "import torch; print('CUDA available:', torch.cuda.is_available()); print('Device:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU')"
Write-Host "Done." -ForegroundColor Green
