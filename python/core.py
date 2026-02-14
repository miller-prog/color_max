# core.py - Tokenization, color mapping, canvas layout, similarity, trends (no GUI)
import math
import os
import re
import random
from concurrent.futures import ProcessPoolExecutor, as_completed
import multiprocessing
from typing import List, Dict, Optional, Tuple, Any

# For parallel tokenization (must be picklable top-level; calls _tokenize_single to avoid recursion)
def _tokenize_chunk(args: Tuple[str, str, str]) -> List[str]:
    chunk, mode, custom_sep = args
    return _tokenize_single(chunk, mode, custom_sep or ",")


def hash_string(s: str) -> int:
    h = 0
    for c in s:
        h = ((h << 5) - h) + ord(c)
        h = h & 0xFFFFFFFF
    return abs(h)


def hash_to_color(h: int) -> str:
    r = (h & 0xFF0000) >> 16
    g = (h & 0x00FF00) >> 8
    b = h & 0x0000FF
    lo = 50
    r, g, b = max(r, lo), max(g, lo), max(b, lo)
    return "#{:02x}{:02x}{:02x}".format(r, g, b)


def random_color() -> str:
    r = random.randint(50, 255)
    g = random.randint(50, 255)
    b = random.randint(50, 255)
    return "#{:02x}{:02x}{:02x}".format(r, g, b)


def hex_to_rgb(hex_color: str) -> Optional[Tuple[int, int, int]]:
    hex_color = hex_color.lstrip("#")
    if len(hex_color) != 6:
        return None
    try:
        return (
            int(hex_color[0:2], 16),
            int(hex_color[2:4], 16),
            int(hex_color[4:6], 16),
        )
    except ValueError:
        return None


def rgb_to_hex(r: float, g: float, b: float) -> str:
    return "#{:02x}{:02x}{:02x}".format(
        int(round(r)) & 255, int(round(g)) & 255, int(round(b)) & 255
    )


def color_distance(hex1: str, hex2: str) -> float:
    a, b = hex_to_rgb(hex1), hex_to_rgb(hex2)
    if a is None or b is None:
        return float("inf")
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)


def max_color_distance() -> float:
    return math.sqrt(255 * 255 * 3)


def emphasize_similar_colors(
    color_map: Dict[str, str],
    threshold: float,
    emphasize_on: bool,
) -> Dict[str, str]:
    if not emphasize_on or threshold <= 0:
        return dict(color_map)
    thresh_dist = (threshold / 100.0) * max_color_distance()
    step = max(1, int(thresh_dist / math.sqrt(3)))
    bins: Dict[str, Dict[str, Any]] = {}
    for token, color in color_map.items():
        rgb = hex_to_rgb(color)
        if rgb is None:
            continue
        r, g, b = rgb
        bi, bj, bk = min(255, r // step), min(255, g // step), min(255, b // step)
        key = f"{bi},{bj},{bk}"
        if key not in bins:
            bins[key] = {"tokens": [], "total_r": 0, "total_g": 0, "total_b": 0, "count": 0}
        bins[key]["tokens"].append(token)
        bins[key]["total_r"] += r
        bins[key]["total_g"] += g
        bins[key]["total_b"] += b
        bins[key]["count"] += 1
    out = {}
    for b in bins.values():
        n = b["count"]
        avg = (b["total_r"] / n, b["total_g"] / n, b["total_b"] / n)
        hex_avg = rgb_to_hex(avg[0], avg[1], avg[2])
        for t in b["tokens"]:
            out[t] = hex_avg
    return out


def tokenize(
    text: str,
    mode: str = "words",
    custom_sep: str = ",",
) -> List[str]:
    if not text or not isinstance(text, str):
        return []
    raw = text.strip()
    if not raw:
        return []
    # Parallel path for very long text (use multiple CPU cores)
    _PARALLEL_TOKENIZE_MIN_LEN = 500_000
    n_workers = multiprocessing.cpu_count() or 4
    n_workers = min(n_workers, 32)
    if len(raw) >= _PARALLEL_TOKENIZE_MIN_LEN and n_workers > 1:
        lines = re.split(r"[\r\n]+", raw)
        if not lines:
            return _tokenize_single(raw, mode, custom_sep)
        K = min(n_workers, max(1, len(lines)))
        seg_size = (len(lines) + K - 1) // K
        chunks = []
        for i in range(K):
            start = i * seg_size
            end = min(start + seg_size, len(lines))
            if start < end:
                chunks.append(("\n".join(lines[start:end]), mode, custom_sep or ","))
        if not chunks:
            return _tokenize_single(raw, mode, custom_sep)
        try:
            with ProcessPoolExecutor(max_workers=K) as ex:
                results = list(ex.map(_tokenize_chunk, chunks))
            out = []
            for r in results:
                out.extend(r)
            return out
        except Exception:
            return _tokenize_single(raw, mode, custom_sep)
    return _tokenize_single(raw, mode, custom_sep)


def _tokenize_single(raw: str, mode: str, custom_sep: str) -> List[str]:
    if mode == "words":
        return [t for t in re.split(r"\s+", raw) if t]
    if mode == "chars":
        return [c for c in raw if c.strip() or c == " "]
    if mode == "lines":
        return [t for t in re.split(r"[\r\n]+", raw) if t]
    if mode == "custom":
        try:
            return [t.strip() for t in re.split(custom_sep, raw) if t.strip()]
        except (re.error, TypeError):
            return [t.strip() for t in raw.split(custom_sep or ",") if t.strip()]
    return [t for t in re.split(r"\s+", raw) if t]


def get_color_for_token(
    token: str,
    mode: str,
    color_map: Dict[str, str],
) -> str:
    if token in color_map:
        return color_map[token]
    if mode == "standard":
        color = hash_to_color(hash_string(token))
    else:
        color = random_color()
    color_map[token] = color
    return color


def fill_color_map(tokens: List[str], mode: str, color_map: Dict[str, str]) -> None:
    """Fill color_map for all tokens in one pass. Faster than 9M get_color_for_token calls."""
    if mode == "standard":
        for token in tokens:
            if token not in color_map:
                color_map[token] = hash_to_color(hash_string(token))
    else:
        for token in tokens:
            if token not in color_map:
                color_map[token] = random_color()


def calculate_canvas_size(
    n_tokens: int,
    pixel_size: int,
    shape: str,
) -> Dict[str, Any]:
    if n_tokens == 0:
        return {
            "width": 0, "height": 0, "cols": 0, "rows": 0,
            "center_x": 0, "center_y": 0, "radius": 0,
        }
    cols = rows = width = height = 0
    center_x = center_y = radius = None
    if shape == "square":
        # Force square grid so canvas is square (cols == rows)
        side = math.ceil(math.sqrt(n_tokens))
        cols = rows = side
        width = height = side * pixel_size
    elif shape == "rectangle":
        cols = math.ceil(math.sqrt(n_tokens * 2))
        rows = math.ceil(n_tokens / cols)
        width, height = cols * pixel_size, rows * pixel_size
    elif shape == "tall":
        rows = math.ceil(math.sqrt(n_tokens * 2))
        cols = math.ceil(n_tokens / rows)
        width, height = cols * pixel_size, rows * pixel_size
    elif shape == "circle":
        area = n_tokens
        radius = math.ceil(math.sqrt(area / math.pi)) * pixel_size
        width = height = radius * 2 + pixel_size
        center_x, center_y = width / 2, height / 2
        cols = math.ceil(math.sqrt(n_tokens))
        rows = math.ceil(n_tokens / cols)
    elif shape == "spiral":
        cols = math.ceil(math.sqrt(n_tokens))
        rows = math.ceil(n_tokens / cols)
        width, height = cols * pixel_size, rows * pixel_size
        center_x, center_y = width / 2, height / 2
    elif shape == "triangle":
        n = 1
        while n * (n + 1) // 2 < n_tokens:
            n += 1
        cols = rows = n
        width, height = cols * pixel_size, rows * pixel_size
    else:
        cols = math.ceil(math.sqrt(n_tokens))
        rows = math.ceil(n_tokens / cols)
        width, height = cols * pixel_size, rows * pixel_size
    return {
        "width": width,
        "height": height,
        "cols": cols,
        "rows": rows,
        "center_x": center_x if center_x is not None else width / 2,
        "center_y": center_y if center_y is not None else height / 2,
        "radius": radius if radius is not None else min(width, height) / 2,
    }


def _spiral_in_positions(tokens: List[str], cols: int, rows: int, pixel_size: int) -> List[Dict]:
    grid = [[None] * cols for _ in range(rows)]
    r, c = 0, 0
    min_r, max_r, min_c, max_c = 0, rows - 1, 0, cols - 1
    direction = 0  # 0 right, 1 down, 2 left, 3 up
    for i in range(len(tokens)):
        grid[r][c] = i
        if direction == 0:
            if c >= max_c:
                direction = 1
                min_r += 1
                r += 1
            else:
                c += 1
        elif direction == 1:
            if r >= max_r:
                direction = 2
                max_c -= 1
                c -= 1
            else:
                r += 1
        elif direction == 2:
            if c <= min_c:
                direction = 3
                max_r -= 1
                r -= 1
            else:
                c -= 1
        else:
            if r <= min_r:
                direction = 0
                min_c += 1
                c += 1
            else:
                r -= 1
    out = []
    for ri, row in enumerate(grid):
        for ci, idx in enumerate(row):
            if idx is not None and idx < len(tokens):
                out.append({
                    "token": tokens[idx], "row": ri, "col": ci,
                    "x": ci * pixel_size, "y": ri * pixel_size, "valid": True,
                })
    return out


def _spiral_out_positions(tokens: List[str], cols: int, rows: int, pixel_size: int) -> List[Dict]:
    grid = [[None] * cols for _ in range(rows)]
    sr, sc = rows // 2, cols // 2
    r, c = sr, sc
    step, step_count, direction = 1, 0, 0
    idx = 0
    if idx < len(tokens) and 0 <= r < rows and 0 <= c < cols:
        grid[r][c] = idx
        idx += 1
    while idx < len(tokens):
        if direction == 0:
            c += 1
        elif direction == 1:
            r -= 1
        elif direction == 2:
            c -= 1
        else:
            r += 1
        step_count += 1
        if 0 <= r < rows and 0 <= c < cols and idx < len(tokens):
            grid[r][c] = idx
            idx += 1
        if step_count >= step:
            step_count = 0
            direction = (direction + 1) % 4
            if direction in (0, 2):
                step += 1
    out = []
    for ri, row in enumerate(grid):
        for ci, token_idx in enumerate(row):
            if token_idx is not None and token_idx < len(tokens):
                out.append({
                    "token": tokens[token_idx], "row": ri, "col": ci,
                    "x": ci * pixel_size, "y": ri * pixel_size, "valid": True,
                })
    return out


def _diagonal_positions(tokens: List[str], cols: int, rows: int, pixel_size: int) -> List[Dict]:
    grid = [[None] * cols for _ in range(rows)]
    idx = 0
    for s in range(rows + cols - 1):
        if idx >= len(tokens):
            break
        for row in range(rows):
            col = s - row
            if 0 <= col < cols and idx < len(tokens):
                grid[row][col] = idx
                idx += 1
    out = []
    for ri, row in enumerate(grid):
        for ci, token_idx in enumerate(row):
            if token_idx is not None and token_idx < len(tokens):
                out.append({
                    "token": tokens[token_idx], "row": ri, "col": ci,
                    "x": ci * pixel_size, "y": ri * pixel_size, "valid": True,
                })
    return out


def generate_pixel_positions(
    tokens: List[str],
    canvas_info: Dict[str, Any],
    pattern: str,
    pixel_size: int,
) -> List[Dict]:
    cols = canvas_info["cols"]
    rows = canvas_info["rows"]
    positions = []
    if pattern == "row-major":
        for i, token in enumerate(tokens):
            row, col = i // cols, i % cols
            positions.append({
                "token": token, "row": row, "col": col,
                "x": col * pixel_size, "y": row * pixel_size, "valid": True,
            })
    elif pattern == "column-major":
        for i, token in enumerate(tokens):
            col, row = i // rows, i % rows
            positions.append({
                "token": token, "row": row, "col": col,
                "x": col * pixel_size, "y": row * pixel_size, "valid": True,
            })
    elif pattern == "spiral-in":
        positions = _spiral_in_positions(tokens, cols, rows, pixel_size)
    elif pattern == "spiral-out":
        positions = _spiral_out_positions(tokens, cols, rows, pixel_size)
    elif pattern == "zigzag":
        for i, token in enumerate(tokens):
            row, col = i // cols, i % cols
            actual_col = col if row % 2 == 0 else cols - 1 - col
            positions.append({
                "token": token, "row": row, "col": actual_col,
                "x": actual_col * pixel_size, "y": row * pixel_size, "valid": True,
            })
    elif pattern == "zigzag-col":
        for i, token in enumerate(tokens):
            col, row = i // rows, i % rows
            actual_row = row if col % 2 == 0 else rows - 1 - row
            positions.append({
                "token": token, "row": actual_row, "col": col,
                "x": col * pixel_size, "y": actual_row * pixel_size, "valid": True,
            })
    elif pattern == "diagonal":
        positions = _diagonal_positions(tokens, cols, rows, pixel_size)
    elif pattern == "random":
        # O(n) placement: shuffle all (row,col) and assign tokens (no collision loop)
        all_cells = [(r, c) for r in range(rows) for c in range(cols)]
        random.shuffle(all_cells)
        for i, token in enumerate(tokens):
            if i >= len(all_cells):
                break
            row, col = all_cells[i]
            positions.append({
                "token": token, "row": row, "col": col,
                "x": col * pixel_size, "y": row * pixel_size, "valid": True,
            })
    else:
        for i, token in enumerate(tokens):
            row, col = i // cols, i % cols
            positions.append({
                "token": token, "row": row, "col": col,
                "x": col * pixel_size, "y": row * pixel_size, "valid": True,
            })
    return positions


def is_valid_position(
    pos: Dict,
    canvas_info: Dict[str, Any],
    shape: str,
    pixel_size: int,
) -> bool:
    if not pos.get("valid", True):
        return False
    row, col = pos["row"], pos["col"]
    cols, rows = canvas_info["cols"], canvas_info["rows"]
    cx, cy = canvas_info["center_x"], canvas_info["center_y"]
    radius = canvas_info["radius"]
    x, y = pos["x"], pos["y"]
    if shape == "circle":
        dx = x + pixel_size / 2 - cx
        dy = y + pixel_size / 2 - cy
        return math.sqrt(dx * dx + dy * dy) <= radius
    if shape == "triangle":
        return col <= row
    return 0 <= row < rows and 0 <= col < cols


def build_position_color_map(
    pixel_positions: List[Dict],
    display_color_map: Dict[str, str],
    token_color_map: Dict[str, str],
) -> Dict[Tuple[int, int], str]:
    m = {}
    for p in pixel_positions:
        if not p.get("valid", True):
            continue
        key = (p["row"], p["col"])
        m[key] = display_color_map.get(p["token"]) or token_color_map.get(p["token"])
    return m


def get_color_at_position(
    row: int,
    col: int,
    position_color_map: Optional[Dict[Tuple[int, int], str]],
    pixel_positions: List[Dict],
    display_color_map: Dict[str, str],
    token_color_map: Dict[str, str],
) -> Optional[str]:
    if position_color_map is not None:
        key = (row, col)
        if key in position_color_map:
            return position_color_map[key]
    for p in pixel_positions:
        if p.get("row") == row and p.get("col") == col and p.get("valid", True):
            return display_color_map.get(p["token"]) or token_color_map.get(p["token"])
    return None


def detect_trends(
    cols: int,
    rows: int,
    direction: str,
    position_color_map: Dict[Tuple[int, int], str],
    trend_min_length: int,
    trend_similarity_pct: float,
) -> List[List[Tuple[int, int]]]:
    trends = []
    thresh = (trend_similarity_pct / 100.0) * max_color_distance()

    def get_color(r: int, c: int) -> Optional[str]:
        return position_color_map.get((r, c))

    def run_sequence(seq):
        current, last_color = [], None
        for row, col in seq:
            color = get_color(row, col)
            if not color:
                continue
            if last_color is None:
                current.append((row, col))
                last_color = color
            else:
                if color_distance(color, last_color) <= thresh:
                    current.append((row, col))
                else:
                    if len(current) >= trend_min_length:
                        trends.append(current)
                    current = [(row, col)]
                    last_color = color
        if len(current) >= trend_min_length:
            trends.append(current)

    if direction == "horizontal":
        for row in range(rows):
            run_sequence([(row, c) for c in range(cols)])
    elif direction == "vertical":
        for col in range(cols):
            run_sequence([(r, col) for r in range(rows)])
    else:  # diagonal
        for start_row in range(rows):
            run_sequence([
                (start_row + o, o)
                for o in range(min(rows - start_row, cols))
            ])
        for start_col in range(1, cols):
            run_sequence([
                (o, start_col + o)
                for o in range(min(rows, cols - start_col))
            ])
        for start_row in range(rows):
            run_sequence([
                (start_row + o, cols - 1 - o)
                for o in range(min(rows - start_row, cols))
            ])
        for start_col in range(cols - 2, -1, -1):
            run_sequence([
                (o, start_col - o)
                for o in range(min(rows, start_col + 1))
            ])
    return trends


def detect_all_trends(
    cols: int,
    rows: int,
    position_color_map: Dict[Tuple[int, int], str],
    trend_min_length: int,
    trend_similarity_pct: float,
    horizontal: bool = True,
    vertical: bool = True,
    diagonal: bool = True,
) -> List[List[Tuple[int, int]]]:
    """Run trend detection for enabled directions; use parallel workers when grid is large."""
    directions = []
    if horizontal:
        directions.append("horizontal")
    if vertical:
        directions.append("vertical")
    if diagonal:
        directions.append("diagonal")
    if not directions:
        return []
    # Use parallel process pool when grid is large to use multiple CPU cores
    _PARALLEL_TRENDS_MIN_CELLS = 100_000
    if cols * rows >= _PARALLEL_TRENDS_MIN_CELLS and len(directions) > 1:
        try:
            all_trends: List[List[Tuple[int, int]]] = []
            with ProcessPoolExecutor(max_workers=min(3, len(directions))) as ex:
                futures = {
                    ex.submit(
                        detect_trends,
                        cols,
                        rows,
                        d,
                        position_color_map,
                        trend_min_length,
                        trend_similarity_pct,
                    ): d
                    for d in directions
                }
                for fut in as_completed(futures):
                    all_trends.extend(fut.result())
            return all_trends
        except Exception:
            pass
    all_trends = []
    for d in directions:
        all_trends.extend(
            detect_trends(
                cols, rows, d,
                position_color_map,
                trend_min_length,
                trend_similarity_pct,
            )
        )
    return all_trends
