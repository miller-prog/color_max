# render_2d.py - Draw pixel grid to PIL Image (numpy + optional numba/GPU)
from typing import List, Dict, Optional, Tuple
import numpy as np
from PIL import Image

import core

# Optional: PyTorch GPU (RTX 5060 etc.) - use for large token counts
try:
    import torch
    HAS_TORCH = True
    TORCH_CUDA = torch.cuda.is_available()
    TORCH_DEVICE = torch.device("cuda") if TORCH_CUDA else torch.device("cpu")
except Exception:
    HAS_TORCH = False
    TORCH_CUDA = False
    TORCH_DEVICE = None

# Optional: JIT-compiled parallel pixel fill (uses all CPU cores when available)
try:
    from numba import njit, prange
    HAS_NUMBA = True
except ImportError:
    HAS_NUMBA = False

if HAS_NUMBA:
    @njit(parallel=True, cache=True, fastmath=True)
    def _fill_pixels_parallel(
        arr: np.ndarray,
        x0s: np.ndarray,
        y0s: np.ndarray,
        x1s: np.ndarray,
        y1s: np.ndarray,
        rs: np.ndarray,
        gs: np.ndarray,
        bs: np.ndarray,
    ) -> None:
        n = x0s.shape[0]
        for i in prange(n):
            x0, y0 = int(x0s[i]), int(y0s[i])
            x1, y1 = int(x1s[i]), int(y1s[i])
            r, g, b = rs[i], gs[i], bs[i]
            for py in range(y0, y1):
                for px in range(x0, x1):
                    arr[py, px, 0] = r
                    arr[py, px, 1] = g
                    arr[py, px, 2] = b


def _fill_pixels_gpu(
    h: int, w: int, valid_data: List[Tuple[int, int, int, int, int, int, int]]
) -> np.ndarray:
    """Fill canvas on GPU via scatter. valid_data: (x0, y0, x1, y1, r, g, b). Returns (h, w, 3) uint8."""
    total_pixels = 0
    for x0, y0, x1, y1, _r, _g, _b in valid_data:
        total_pixels += max(0, x1 - x0) * max(0, y1 - y0)
    if total_pixels == 0:
        return np.full((h, w, 3), 255, dtype=np.uint8)
    indices = np.empty(total_pixels, dtype=np.int64)
    colors = np.empty((total_pixels, 3), dtype=np.uint8)
    pos = 0
    for x0, y0, x1, y1, r, g, b in valid_data:
        ny, nx = y1 - y0, x1 - x0
        if ny <= 0 or nx <= 0:
            continue
        yy = np.arange(y0, y1, dtype=np.int64)
        xx = np.arange(x0, x1, dtype=np.int64)
        idx_2d = yy[:, None] * w + xx[None, :]
        n = idx_2d.size
        indices[pos : pos + n] = idx_2d.ravel()
        colors[pos : pos + n, 0] = r
        colors[pos : pos + n, 1] = g
        colors[pos : pos + n, 2] = b
        pos += n
    indices = indices[:pos]
    colors = colors[:pos]
    dev = TORCH_DEVICE
    canvas_flat = torch.full((h * w, 3), 255, dtype=torch.uint8, device=dev)
    idx = torch.from_numpy(indices).to(dev)
    col = torch.from_numpy(colors).to(dev)
    canvas_flat.scatter_(0, idx.unsqueeze(1).expand(-1, 3), col)
    arr = canvas_flat.cpu().numpy().reshape(h, w, 3)
    return arr


def hex_to_rgb_tuple(hex_color: str) -> Tuple[int, int, int]:
    r = core.hex_to_rgb(hex_color)
    return r if r else (128, 128, 128)


def draw_canvas(
    pixel_positions: List[Dict],
    canvas_info: Dict,
    display_color_map: Dict[str, str],
    token_color_map: Dict[str, str],
    pixel_size: int,
    highlight_trends: bool = False,
    trend_cells: Optional[List[Tuple[int, int]]] = None,
    highlight_color: str = "#ffff00",
    highlight_opacity: float = 0.5,
    scale: float = 1,
) -> Image.Image:
    w = max(1, int(int(canvas_info["width"]) * scale))
    h = max(1, int(int(canvas_info["height"]) * scale))
    if w <= 0 or h <= 0:
        return Image.new("RGB", (1, 1), (255, 255, 255))

    arr = np.full((h, w, 3), 255, dtype=np.uint8)
    trend_set = set(trend_cells) if trend_cells else set()
    hr, hg, hb = hex_to_rgb_tuple(highlight_color)

    # Use exact integer block bounds from (row,col) so scaled blocks tile with no gaps/lines
    def block_bounds(row: int, col: int):
        x0 = int(col * pixel_size * scale)
        y0 = int(row * pixel_size * scale)
        x1 = min(w, int((col + 1) * pixel_size * scale))
        y1 = min(h, int((row + 1) * pixel_size * scale))
        if x1 <= x0:
            x1 = x0 + 1
        if y1 <= y0:
            y1 = y0 + 1
        return x0, y0, x1, y1

    valid_data = []
    for p in pixel_positions:
        if not p.get("valid", True):
            continue
        color = display_color_map.get(p["token"]) or token_color_map.get(p["token"])
        if not color:
            continue
        r, g, b = hex_to_rgb_tuple(color)
        if highlight_trends and (p["row"], p["col"]) in trend_set:
            r = int(r * (1 - highlight_opacity) + hr * highlight_opacity)
            g = int(g * (1 - highlight_opacity) + hg * highlight_opacity)
            b = int(b * (1 - highlight_opacity) + hb * highlight_opacity)
        row, col = p["row"], p["col"]
        x0, y0, x1, y1 = block_bounds(row, col)
        valid_data.append((x0, y0, x1, y1, r, g, b))

    if not valid_data:
        return Image.fromarray(arr, mode="RGB")

    n = len(valid_data)
    # Prefer numba (fast, no transfer); then GPU for very large; else loop
    use_numba = HAS_NUMBA and n >= 500
    use_gpu = TORCH_CUDA and n >= 8000 and not use_numba
    if use_gpu:
        arr = _fill_pixels_gpu(h, w, valid_data)
    elif use_numba:
        x0s = np.array([v[0] for v in valid_data], dtype=np.int32)
        y0s = np.array([v[1] for v in valid_data], dtype=np.int32)
        x1s = np.array([v[2] for v in valid_data], dtype=np.int32)
        y1s = np.array([v[3] for v in valid_data], dtype=np.int32)
        rs = np.array([v[4] for v in valid_data], dtype=np.uint8)
        gs = np.array([v[5] for v in valid_data], dtype=np.uint8)
        bs = np.array([v[6] for v in valid_data], dtype=np.uint8)
        _fill_pixels_parallel(arr, x0s, y0s, x1s, y1s, rs, gs, bs)
    else:
        for x0, y0, x1, y1, r, g, b in valid_data:
            arr[y0:y1, x0:x1, 0] = r
            arr[y0:y1, x0:x1, 1] = g
            arr[y0:y1, x0:x1, 2] = b

    return Image.fromarray(arr, mode="RGB")
