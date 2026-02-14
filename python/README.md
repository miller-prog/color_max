# Token Color Mapper — Python

Python desktop port of **Token Color Mapper**. Same idea: turn text into colored pixel maps (and 3D views) using tokens, color modes, shapes, and arrangement patterns.

## Requirements

- **Python 3.9+**
- Dependencies in `requirements.txt`

## Setup

```bash
cd python-app
pip install -r requirements.txt
```

**GPU (RTX 5060 / RTX 50 series):** Use PyTorch 2.9.1 with CUDA 12.8 so 2D render uses the GPU:

```powershell
# Windows (PowerShell) - run from python-app folder
.\install_requirements.ps1
```

Or manually (RTX 50 needs cu128; older GPUs can use cu126):

```bash
pip install torch==2.9.1 torchvision==0.24.1 torchaudio==2.9.1 --index-url https://download.pytorch.org/whl/cu128
```

On startup the app prints `2D render: GPU (NVIDIA GeForce RTX 5060)` when the GPU is used.

## Run

```bash
python main.py
```

## Features (parity with HTML/JS desktop app)

- **Tokenize by:** words, characters, lines, or custom separator (regex; falls back to literal split on error)
- **Color mode:** standard (deterministic hash) or random
- **Pixel size:** 1–50
- **Canvas shape:** square, rectangle (wide/tall), circle, spiral, triangle
- **Arrangement:** row-major, column-major, spiral in/out, zigzag (row/col), diagonal, random
- **Emphasize color similarity:** threshold 0–100% (O(n) RGB quantization)
- **Highlight pixel trends:** H/V/D with min length, similarity %, **opacity %**, and **highlight color** (picker)
- **Views:** 2D pixel grid (default), 3D grid, RGB 3D (color space); 3D/RGB 3D subsample to 15k points for performance
- **Export:** high-res PNG (scale 2×–256× or **custom 1–512**; max dimension 32,768 px), **video** (MP4/GIF of RGB 3D sequence), JSON color mapping
- **File:** open/save text, import/export color mapping (JSON)
- **Settings:** saved to `token_color_mapper_settings.json` (includes trend opacity, highlight color, export scale)

## Performance (large text and 64GB RAM)

- **2D:** Numpy-backed draw; **numba** JIT parallel fill (all CPU cores) when token count >= 2000. Preview cap is **RAM-aware** (psutil): 16GB -> 2400 px, 32GB+ -> 3600 px per side.
- **Random arrangement:** Shuffle of all (row,col) then assign first N tokens (O(n)); no collision loop.
- **Tokenization:** Text >= 500k chars tokenized in **parallel**. **Trend detection:** position->color map; grids >= 100k cells run H/V/D in **parallel**.
- **Text input:** 250 ms debounce so typing doesn’t re-render on every key.
- **3D / RGB 3D:** Subsampling **RAM-aware**: 16GB -> 50k points, 32GB+ -> 100k points.
- **Video export:** Requires `imageio` and `imageio-ffmpeg`; records RGB 3D view as points appear in sequence.

## Project layout

```
python-app/
├── main.py          # Tkinter GUI, app state, 2D/3D display
├── core.py          # Tokenize, colors, canvas size, positions, similarity, trends
├── render_2d.py     # Draw 2D grid to PIL Image
├── requirements.txt
└── README.md
```

## Dependencies

| Package          | Purpose                                      |
|------------------|----------------------------------------------|
| Pillow           | 2D image and export                          |
| matplotlib       | 3D and RGB 3D views in GUI                   |
| numpy            | Fast 2D pixel buffer, matplotlib             |
| imageio          | Video export (MP4/GIF)                       |
| imageio-ffmpeg   | MP4 encoding for video export                |
| **numba**        | JIT-compiled parallel pixel fill (all cores)  |
| **psutil**       | RAM detection for preview/3D limits (64GB)   |
| **torch**        | GPU 2D render (PyTorch 2.9.1+cu128 for RTX 5060) |

Install all with `pip install -r requirements.txt`. For RTX 5060 run `install_requirements.ps1` or install torch with `--index-url https://download.pytorch.org/whl/cu128`. Without numba/psutil/torch the app still runs with single-thread fill and fixed limits.

## Platform

Developed and tested on Windows; should run on macOS and Linux with the same setup.
