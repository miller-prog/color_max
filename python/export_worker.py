# export_worker.py - Run export in a subprocess (no tkinter) so UI stays responsive
"""Export image worker for use in a separate process. Handles very large token counts."""
from typing import Dict, Any
from multiprocessing import Queue

import core
from render_2d import draw_canvas

# Skip trend detection above this many grid cells (keeps export finishable for 9M+ tokens)
EXPORT_TREND_MAX_CELLS = 2_000_000


def run_export_image(text: str, opts: Dict[str, Any], path: str, result_queue: Queue) -> None:
    """Run full export (tokenize, color, positions, optional trend, draw, save). Puts result in queue."""
    try:
        tokens = core.tokenize(
            text,
            mode=opts["tokenize_mode"],
            custom_sep=opts["custom_separator"],
        )
        if not tokens:
            result_queue.put({"ok": False, "error": "No tokens to export."})
            return

        # Build color map for all tokens (batch fill is faster for millions of tokens)
        color_map: Dict[str, str] = {}
        core.fill_color_map(tokens, opts["current_mode"], color_map)
        display_map = core.emphasize_similar_colors(
            color_map, opts["similarity_threshold"], opts["emphasize_similarity"]
        )

        scale = opts["export_scale"]
        canvas_info = core.calculate_canvas_size(len(tokens), opts["pixel_size"], opts["canvas_shape"])
        w, h = int(canvas_info["width"]), int(canvas_info["height"])
        out_w, out_h = w * scale, h * scale
        max_dim = 32768
        if out_w > max_dim or out_h > max_dim:
            r = min(max_dim / out_w, max_dim / out_h)
            out_w, out_h = int(out_w * r), int(out_h * r)
            scale = out_w / w if w else 1

        positions = core.generate_pixel_positions(
            tokens, canvas_info, opts["arrangement_pattern"], opts["pixel_size"]
        )
        for p in positions:
            p["valid"] = core.is_valid_position(
                p, canvas_info, opts["canvas_shape"], opts["pixel_size"]
            )

        # Skip trend detection for huge grids so export can finish in reasonable time
        trend_cells = set()
        cells = canvas_info["cols"] * canvas_info["rows"]
        if opts["highlight_trends"] and cells <= EXPORT_TREND_MAX_CELLS:
            pos_map = core.build_position_color_map(positions, display_map, color_map)
            for trend in core.detect_all_trends(
                canvas_info["cols"], canvas_info["rows"],
                pos_map, opts["trend_min_length"], opts["trend_similarity"],
                horizontal=opts["trend_horizontal"],
                vertical=opts["trend_vertical"],
                diagonal=opts["trend_diagonal"],
            ):
                for c in trend:
                    trend_cells.add(c)

        img = draw_canvas(
            positions, canvas_info, display_map, color_map, opts["pixel_size"],
            highlight_trends=opts["highlight_trends"],
            trend_cells=list(trend_cells) if trend_cells else None,
            highlight_color=opts["highlight_color_hex"],
            highlight_opacity=opts["trend_opacity"] / 100.0,
            scale=scale,
        )
        img.save(path)
        result_queue.put({"ok": True, "path": path})
    except Exception as e:
        result_queue.put({"ok": False, "error": str(e)})
