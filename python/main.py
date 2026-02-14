#!/usr/bin/env python3
"""
Token Color Mapper - Python desktop application.
Run: python main.py
"""
import json
import os
import random
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, colorchooser
from typing import Dict, List, Optional, Any
from multiprocessing import Process, Queue
from queue import Empty
from PIL import Image
import core
from render_2d import draw_canvas
from export_worker import run_export_image as run_export_image_worker

SETTINGS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "token_color_mapper_settings.json")


class TokenColorMapperApp:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Token Color Mapper")
        self.root.minsize(900, 700)
        self.root.geometry("1200x800")

        self.token_color_map: Dict[str, str] = {}
        self.pixel_positions: List[Dict] = []
        self.current_mode = "standard"
        self.pixel_size = 10
        self.canvas_shape = "square"
        self.arrangement_pattern = "row-major"
        self.tokenize_mode = "words"
        self.custom_separator = ","
        self.emphasize_similarity = False
        self.similarity_threshold = 50
        self.highlight_trends = False
        self.trend_horizontal = True
        self.trend_vertical = True
        self.trend_diagonal = True
        self.trend_min_length = 3
        self.trend_similarity = 30
        self.trend_opacity = 50
        self.highlight_color_hex = "#ffff00"
        self.export_scale = 4

        self._build_ui()
        self._load_settings()
        self._log_backend()
        self._render()

    def _build_ui(self):
        main = ttk.Frame(self.root, padding=10)
        main.pack(fill=tk.BOTH, expand=True)

        # Text input
        ttk.Label(main, text="Enter text:").pack(anchor=tk.W)
        self.text_input = tk.Text(main, height=6, wrap=tk.WORD)
        self.text_input.pack(fill=tk.X, pady=(0, 8))
        self.text_input.bind("<KeyRelease>", self._schedule_render)
        self.text_input.bind("<<Paste>>", self._on_paste)

        # Tokenize
        row1 = ttk.Frame(main)
        row1.pack(fill=tk.X, pady=4)
        ttk.Label(row1, text="Tokenize by:").pack(side=tk.LEFT, padx=(0, 8))
        self.tokenize_var = tk.StringVar(value="words")
        ttk.Combobox(
            row1,
            textvariable=self.tokenize_var,
            values=["words", "chars", "lines", "custom"],
            state="readonly",
            width=12,
        ).pack(side=tk.LEFT, padx=(0, 8))
        self.tokenize_var.trace_add("write", lambda *a: self._render())
        ttk.Label(row1, text="Custom sep:").pack(side=tk.LEFT, padx=(0, 4))
        self.custom_sep_var = tk.StringVar(value=",")
        self.custom_sep_entry = ttk.Entry(row1, textvariable=self.custom_sep_var, width=8)
        self.custom_sep_entry.pack(side=tk.LEFT)
        self.custom_sep_var.trace_add("write", lambda *a: self._render())

        # Color mode
        row2 = ttk.Frame(main)
        row2.pack(fill=tk.X, pady=4)
        ttk.Label(row2, text="Color mode:").pack(side=tk.LEFT, padx=(0, 8))
        self.mode_var = tk.StringVar(value="standard")
        ttk.Radiobutton(row2, text="Standard (deterministic)", variable=self.mode_var, value="standard", command=self._render).pack(side=tk.LEFT, padx=(0, 12))
        ttk.Radiobutton(row2, text="Random", variable=self.mode_var, value="random", command=self._render).pack(side=tk.LEFT)

        # Pixel size
        row3 = ttk.Frame(main)
        row3.pack(fill=tk.X, pady=4)
        ttk.Label(row3, text="Pixel size:").pack(side=tk.LEFT, padx=(0, 8))
        self.pixel_size_var = tk.IntVar(value=10)
        ttk.Spinbox(row3, from_=1, to=50, textvariable=self.pixel_size_var, width=5, command=self._render).pack(side=tk.LEFT, padx=(0, 8))
        self.pixel_size_var.trace_add("write", lambda *a: self._render())

        # Shape & pattern
        row4 = ttk.Frame(main)
        row4.pack(fill=tk.X, pady=4)
        ttk.Label(row4, text="Shape:").pack(side=tk.LEFT, padx=(0, 8))
        self.shape_var = tk.StringVar(value="square")
        ttk.Combobox(row4, textvariable=self.shape_var, values=["square", "rectangle", "tall", "circle", "spiral", "triangle"], state="readonly", width=10).pack(side=tk.LEFT, padx=(0, 16))
        self.shape_var.trace_add("write", lambda *a: self._render())
        ttk.Label(row4, text="Pattern:").pack(side=tk.LEFT, padx=(0, 8))
        self.pattern_var = tk.StringVar(value="row-major")
        ttk.Combobox(
            row4,
            textvariable=self.pattern_var,
            values=["row-major", "column-major", "spiral-in", "spiral-out", "zigzag", "zigzag-col", "diagonal", "random"],
            state="readonly",
            width=14,
        ).pack(side=tk.LEFT)
        self.pattern_var.trace_add("write", lambda *a: self._render())

        # Emphasize similarity
        self.emphasize_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(main, text="Emphasize color similarity", variable=self.emphasize_var, command=self._render).pack(anchor=tk.W, pady=2)
        row5 = ttk.Frame(main)
        row5.pack(fill=tk.X, pady=2)
        ttk.Label(row5, text="Similarity threshold %:").pack(side=tk.LEFT, padx=(0, 8))
        self.similarity_var = tk.IntVar(value=50)
        ttk.Scale(row5, from_=0, to=100, variable=self.similarity_var, orient=tk.HORIZONTAL, length=150, command=lambda v: self._render()).pack(side=tk.LEFT, padx=(0, 8))
        ttk.Label(row5, textvariable=self.similarity_var).pack(side=tk.LEFT)

        # Highlight trends
        self.trends_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(main, text="Highlight pixel trends", variable=self.trends_var, command=self._render).pack(anchor=tk.W, pady=2)
        row6 = ttk.Frame(main)
        row6.pack(fill=tk.X, pady=2)
        self.trend_h_var = tk.BooleanVar(value=True)
        self.trend_v_var = tk.BooleanVar(value=True)
        self.trend_d_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(row6, text="H", variable=self.trend_h_var, command=self._render).pack(side=tk.LEFT, padx=(0, 8))
        ttk.Checkbutton(row6, text="V", variable=self.trend_v_var, command=self._render).pack(side=tk.LEFT, padx=(0, 8))
        ttk.Checkbutton(row6, text="D", variable=self.trend_d_var, command=self._render).pack(side=tk.LEFT, padx=(0, 16))
        ttk.Label(row6, text="Min length:").pack(side=tk.LEFT, padx=(0, 4))
        self.trend_min_var = tk.IntVar(value=3)
        ttk.Spinbox(row6, from_=2, to=10, textvariable=self.trend_min_var, width=3, command=self._render).pack(side=tk.LEFT, padx=(0, 8))
        ttk.Label(row6, text="Similarity %:").pack(side=tk.LEFT, padx=(0, 4))
        self.trend_sim_var = tk.IntVar(value=30)
        ttk.Spinbox(row6, from_=0, to=100, textvariable=self.trend_sim_var, width=3, command=self._render).pack(side=tk.LEFT, padx=(0, 8))
        ttk.Label(row6, text="Opacity %:").pack(side=tk.LEFT, padx=(0, 4))
        self.trend_opacity_var = tk.IntVar(value=50)
        ttk.Spinbox(row6, from_=0, to=100, textvariable=self.trend_opacity_var, width=3, command=self._render).pack(side=tk.LEFT, padx=(0, 8))
        ttk.Label(row6, text="Highlight:").pack(side=tk.LEFT, padx=(0, 4))
        self.highlight_color_var = tk.StringVar(value="#ffff00")
        highlight_entry = ttk.Entry(row6, textvariable=self.highlight_color_var, width=8)
        highlight_entry.pack(side=tk.LEFT, padx=(0, 4))
        self.highlight_color_var.trace_add("write", lambda *a: self._render())
        ttk.Button(row6, text="…", width=2, command=self._pick_highlight_color).pack(side=tk.LEFT)

        # Export scale (match desktop: up to 256 + custom 1-512)
        row8 = ttk.Frame(main)
        row8.pack(fill=tk.X, pady=4)
        ttk.Label(row8, text="Export image scale:").pack(side=tk.LEFT, padx=(0, 8))
        self.export_scale_var = tk.StringVar(value="4")
        ttk.Combobox(
            row8,
            textvariable=self.export_scale_var,
            values=["2", "4", "8", "16", "32", "64", "128", "256", "custom"],
            state="readonly",
            width=8,
        ).pack(side=tk.LEFT, padx=(0, 8))
        self.export_scale_var.trace_add("write", self._on_export_scale_change)
        ttk.Label(row8, text="Custom (1–512):").pack(side=tk.LEFT, padx=(0, 4))
        self.export_scale_custom_var = tk.StringVar(value="64")
        self.export_scale_custom_entry = ttk.Entry(row8, textvariable=self.export_scale_custom_var, width=5)
        self.export_scale_custom_entry.pack(side=tk.LEFT)
        self._on_export_scale_change()

        # Video export (RGB 3D)
        # Buttons
        btn_frame = ttk.Frame(main)
        btn_frame.pack(fill=tk.X, pady=8)
        ttk.Button(btn_frame, text="Open file...", command=self._open_file).pack(side=tk.LEFT, padx=(0, 8))
        ttk.Button(btn_frame, text="Save text...", command=self._save_text).pack(side=tk.LEFT, padx=(0, 8))
        ttk.Button(btn_frame, text="Re-randomize colors", command=self._randomize).pack(side=tk.LEFT, padx=(0, 8))
        ttk.Button(btn_frame, text="Export image...", command=self._export_image).pack(side=tk.LEFT, padx=(0, 8))
        ttk.Button(btn_frame, text="Export mapping (JSON)...", command=self._export_json).pack(side=tk.LEFT, padx=(0, 8))
        ttk.Button(btn_frame, text="Import mapping (JSON)...", command=self._import_json).pack(side=tk.LEFT)

        # Canvas area: use Canvas so image is shown at natural size (square stays square)
        self.canvas_frame = ttk.Frame(main)
        self.canvas_frame.pack(fill=tk.BOTH, expand=True, pady=8)
        self.display_canvas = tk.Canvas(self.canvas_frame, highlightthickness=0)
        self.display_canvas.pack(fill=tk.BOTH, expand=True)
        self.caption_label = ttk.Label(self.canvas_frame, text="")
        self._render_after_id = None
        self._export_process: Optional[Process] = None
        self._export_queue: Optional[Queue] = None
        self._poll_export_id = None

    def _log_backend(self):
        """Print backend status at startup (GPU / CPU) for debugging."""
        try:
            from render_2d import TORCH_CUDA, HAS_NUMBA
            if TORCH_CUDA:
                import torch
                name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CUDA"
                print(f"[Token Color Mapper] 2D render: GPU ({name})")
            elif HAS_NUMBA:
                print("[Token Color Mapper] 2D render: CPU (numba parallel)")
            else:
                print("[Token Color Mapper] 2D render: CPU (single-thread)")
        except Exception:
            pass

    def _on_export_scale_change(self, *a):
        if not hasattr(self, "export_scale_custom_entry"):
            return
        try:
            is_custom = self.export_scale_var.get() == "custom"
        except Exception:
            is_custom = False
        if is_custom:
            self.export_scale_custom_entry.pack(side=tk.LEFT)
        else:
            self.export_scale_custom_entry.pack_forget()

    def _get_export_scale(self) -> int:
        v = self.export_scale_var.get()
        if v == "custom":
            try:
                n = int(self.export_scale_custom_var.get())
                return min(512, max(1, n))
            except (ValueError, tk.TclError):
                return 64
        try:
            n = int(v)
            return min(512, max(1, n))
        except (ValueError, tk.TclError):
            return 4

    def _schedule_render(self, event=None):
        """Debounce render so typing doesn't trigger a full redraw on every key."""
        if self._render_after_id:
            self.root.after_cancel(self._render_after_id)
        self._render_after_id = self.root.after(400, self._do_render)

    def _on_paste(self, event=None):
        """Prevent default paste; run chunked paste on next idle so handler returns immediately."""
        self.root.after(0, self._paste_chunked)
        return "break"

    def _paste_chunked(self) -> None:
        """Get clipboard and insert in chunks so the UI stays responsive during large paste."""
        try:
            content = self.root.clipboard_get()
        except tk.TclError:
            return
        if not content:
            return
        self._insert_chunked(content)

    def _insert_chunked(self, content: str, chunk_chars: int = 50_000) -> None:
        """Insert content into the text widget in chunks so the UI can update."""
        self.text_input.mark_set("insert", tk.INSERT)
        self.text_input.see(tk.INSERT)
        for i in range(0, len(content), chunk_chars):
            chunk = content[i : i + chunk_chars]
            self.text_input.insert(tk.INSERT, chunk)
            self.root.update_idletasks()
        self._render()

    def _pick_highlight_color(self):
        color = colorchooser.askcolor(
            color=self.highlight_color_var.get() or "#ffff00",
            title="Highlight color",
        )
        if color and color[1]:
            self.highlight_color_var.set(color[1])
            self._render()

    def _get_text_chunked(self, chunk_chars: int = 100_000) -> str:
        """Get full text from the widget in chunks, calling update() so the UI stays responsive on huge content."""
        parts = []
        start = "1.0"
        while True:
            end = self.text_input.index(f"{start}+{chunk_chars}c")
            part = self.text_input.get(start, end)
            if not part:
                break
            parts.append(part)
            self.root.update_idletasks()
            if self.text_input.compare(end, ">=", tk.END):
                break
            start = end
        return "".join(parts)

    def _get_tokens(self) -> List[str]:
        text = self.text_input.get("1.0", tk.END)
        return core.tokenize(
            text,
            mode=self.tokenize_mode,
            custom_sep=self.custom_separator,
        )

    def _render(self):
        """Entry point for controls: run render immediately (no debounce)."""
        if self._render_after_id:
            self.root.after_cancel(self._render_after_id)
            self._render_after_id = None
        self._do_render()

    def _read_options(self) -> Dict[str, Any]:
        """Read current options on main thread (safe)."""
        try:
            pixel_size = max(1, min(50, int(self.pixel_size_var.get())))
        except (ValueError, tk.TclError):
            pixel_size = 10
        try:
            similarity_threshold = max(0, min(100, int(self.similarity_var.get())))
        except (ValueError, tk.TclError):
            similarity_threshold = 50
        try:
            trend_min_length = max(2, min(10, int(self.trend_min_var.get())))
        except (ValueError, tk.TclError):
            trend_min_length = 3
        try:
            trend_similarity = max(0, min(100, int(self.trend_sim_var.get())))
        except (ValueError, tk.TclError):
            trend_similarity = 30
        try:
            trend_opacity = max(0, min(100, int(self.trend_opacity_var.get())))
        except (ValueError, tk.TclError):
            trend_opacity = 50
        hc = (self.highlight_color_var.get() or "#ffff00").strip()
        highlight_color_hex = hc if (hc and hc.startswith("#") and len(hc) in (4, 7)) else "#ffff00"
        return {
            "pixel_size": pixel_size,
            "current_mode": self.mode_var.get(),
            "canvas_shape": self.shape_var.get(),
            "arrangement_pattern": self.pattern_var.get(),
            "tokenize_mode": self.tokenize_var.get(),
            "custom_separator": self.custom_sep_var.get() or ",",
            "emphasize_similarity": self.emphasize_var.get(),
            "similarity_threshold": similarity_threshold,
            "highlight_trends": self.trends_var.get(),
            "trend_horizontal": self.trend_h_var.get(),
            "trend_vertical": self.trend_v_var.get(),
            "trend_diagonal": self.trend_d_var.get(),
            "trend_min_length": trend_min_length,
            "trend_similarity": trend_similarity,
            "trend_opacity": trend_opacity,
            "highlight_color_hex": highlight_color_hex,
        }

    def _has_text_content(self) -> bool:
        """Lightweight check if the text widget has any content. Avoids get(1.0, END) which freezes on huge paste."""
        try:
            return self.text_input.compare("end-1c", ">", "1.0")
        except tk.TclError:
            return False

    def _do_render(self):
        """Update placeholder only. Never reads full text here so paste won't freeze the UI."""
        self._render_after_id = None
        opts = self._read_options()
        self.pixel_size = opts["pixel_size"]
        self.current_mode = opts["current_mode"]
        self.canvas_shape = opts["canvas_shape"]
        self.arrangement_pattern = opts["arrangement_pattern"]
        self.tokenize_mode = opts["tokenize_mode"]
        self.custom_separator = opts["custom_separator"]
        self.emphasize_similarity = opts["emphasize_similarity"]
        self.similarity_threshold = opts["similarity_threshold"]
        self.highlight_trends = opts["highlight_trends"]
        self.trend_horizontal = opts["trend_horizontal"]
        self.trend_vertical = opts["trend_vertical"]
        self.trend_diagonal = opts["trend_diagonal"]
        self.trend_min_length = opts["trend_min_length"]
        self.trend_similarity = opts["trend_similarity"]
        self.trend_opacity = opts["trend_opacity"]
        self.highlight_color_hex = opts["highlight_color_hex"]

        if not self._has_text_content():
            self._show_empty()
            return
        self._show_ready()

    def _show_empty(self):
        self.display_canvas.pack(fill=tk.BOTH, expand=True)
        self.display_canvas.delete("all")
        self.display_canvas.create_text(400, 300, text="Enter text, then use Export image… to generate and save the map.", anchor="center")
        self.caption_label.pack_forget()

    def _show_ready(self):
        self.display_canvas.pack(fill=tk.BOTH, expand=True)
        self.display_canvas.delete("all")
        self.display_canvas.create_text(400, 300, text="Ready. Use Export image… to generate and save the map.", anchor="center")
        self.caption_label.pack_forget()

    def _open_file(self):
        path = filedialog.askopenfilename(filetypes=[("Text", "*.txt"), ("All", "*.*")])
        if not path:
            return
        try:
            self.text_input.delete("1.0", tk.END)
            chunk_size = 100_000
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                while True:
                    chunk = f.read(chunk_size)
                    if not chunk:
                        break
                    self.text_input.insert(tk.END, chunk)
                    self.root.update_idletasks()
            self._render()
        except Exception as e:
            messagebox.showerror("Error", str(e))

    def _save_text(self):
        path = filedialog.asksaveasfilename(defaultextension=".txt", filetypes=[("Text", "*.txt"), ("All", "*.*")])
        if not path:
            return
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(self.text_input.get("1.0", tk.END))
            messagebox.showinfo("Saved", f"Saved to {path}")
        except Exception as e:
            messagebox.showerror("Error", str(e))

    def _randomize(self):
        if self.current_mode != "random":
            messagebox.showinfo("Info", "Re-randomize only applies in Random mode.")
            return
        self.token_color_map.clear()
        self._render()

    def _export_image(self):
        if not self._has_text_content():
            messagebox.showwarning("Warning", "No text to export.")
            return
        path = filedialog.asksaveasfilename(defaultextension=".png", filetypes=[("PNG", "*.png"), ("All", "*.*")])
        if not path:
            return
        if self._export_process is not None and self._export_process.is_alive():
            messagebox.showinfo("Export", "An export is already in progress.")
            return
        # Get text in chunks so UI stays responsive (avoids freeze on millions of tokens)
        text = self._get_text_chunked()
        if not (text or "").strip():
            messagebox.showwarning("Warning", "No text to export.")
            return
        opts = self._read_options()
        self._sync_options_from_read(opts)
        opts["export_scale"] = self._get_export_scale()
        result_queue = Queue()
        p = Process(
            target=run_export_image_worker,
            args=(text, opts, path, result_queue),
            daemon=True,
        )
        p.start()
        self._export_process = p
        self._export_queue = result_queue
        messagebox.showinfo(
            "Exporting",
            "Export started. The window will stay responsive.\n\n"
            "For very large files (millions of tokens) this may take several minutes. "
            "You will see a message when it finishes.",
        )
        self._poll_export_id = self.root.after(200, self._poll_export_result)

    def _sync_options_from_read(self, opts: Dict[str, Any]) -> None:
        """Sync opts from _read_options() into instance for later use."""
        self.pixel_size = opts["pixel_size"]
        self.current_mode = opts["current_mode"]
        self.canvas_shape = opts["canvas_shape"]
        self.arrangement_pattern = opts["arrangement_pattern"]
        self.tokenize_mode = opts["tokenize_mode"]
        self.custom_separator = opts["custom_separator"]
        self.similarity_threshold = opts["similarity_threshold"]
        self.emphasize_similarity = opts["emphasize_similarity"]
        self.highlight_trends = opts["highlight_trends"]
        self.trend_horizontal = opts["trend_horizontal"]
        self.trend_vertical = opts["trend_vertical"]
        self.trend_diagonal = opts["trend_diagonal"]
        self.trend_min_length = opts["trend_min_length"]
        self.trend_similarity = opts["trend_similarity"]
        self.trend_opacity = opts["trend_opacity"]
        self.highlight_color_hex = opts["highlight_color_hex"]

    def _poll_export_result(self):
        """Poll for export result from subprocess."""
        self._poll_export_id = None
        if self._export_queue is None or self._export_process is None:
            return
        try:
            result = self._export_queue.get_nowait()
        except Empty:
            if self._export_process.is_alive():
                self._poll_export_id = self.root.after(200, self._poll_export_result)
            else:
                self._export_process = None
                self._export_queue = None
                messagebox.showerror("Export", "Export process ended without a result.")
            return
        if self._export_process.is_alive():
            self._export_process.join(timeout=3.0)
        self._export_process = None
        self._export_queue = None
        if result.get("ok"):
            messagebox.showinfo("Saved", f"Image saved to {result.get('path', '')}")
        else:
            messagebox.showerror("Export error", result.get("error", "Unknown error"))

    def _export_json(self):
        tokens = self._get_tokens()
        if not tokens:
            messagebox.showwarning("Warning", "No text to export.")
            return
        path = filedialog.asksaveasfilename(defaultextension=".json", filetypes=[("JSON", "*.json"), ("All", "*.*")])
        if not path:
            return
        try:
            # Build color map for all tokens (no preview, so build on export)
            for t in tokens:
                core.get_color_for_token(t, self.current_mode, self.token_color_map)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(self.token_color_map, f, indent=2)
            messagebox.showinfo("Saved", f"Mapping saved to {path}")
        except Exception as e:
            messagebox.showerror("Error", str(e))

    def _import_json(self):
        path = filedialog.askopenfilename(filetypes=[("JSON", "*.json"), ("All", "*.*")])
        if not path:
            return
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.token_color_map.update(data)
            self._render()
            messagebox.showinfo("Imported", "Color mapping imported.")
        except Exception as e:
            messagebox.showerror("Error", str(e))

    def _load_settings(self):
        if not os.path.isfile(SETTINGS_FILE):
            return
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                s = json.load(f)
            if "pixel_size" in s:
                self.pixel_size_var.set(s["pixel_size"])
            if "mode" in s:
                self.mode_var.set(s["mode"])
            if "shape" in s:
                self.shape_var.set(s["shape"])
            if "pattern" in s:
                self.pattern_var.set(s["pattern"])
            if "tokenize_mode" in s:
                self.tokenize_var.set(s["tokenize_mode"])
            if "export_scale" in s:
                self.export_scale_var.set(str(s["export_scale"]))
            if "export_scale_custom" in s and hasattr(self, "export_scale_custom_var"):
                self.export_scale_custom_var.set(str(s["export_scale_custom"]))
            if "trend_opacity" in s and hasattr(self, "trend_opacity_var"):
                self.trend_opacity_var.set(s["trend_opacity"])
            if "highlight_color" in s and hasattr(self, "highlight_color_var"):
                self.highlight_color_var.set(s["highlight_color"])
            self._on_export_scale_change()
        except Exception:
            pass

    def _save_settings(self):
        try:
            s = {
                "pixel_size": self.pixel_size_var.get(),
                "mode": self.mode_var.get(),
                "shape": self.shape_var.get(),
                "pattern": self.pattern_var.get(),
                "tokenize_mode": self.tokenize_var.get(),
                "export_scale": self.export_scale_var.get(),
            }
            if hasattr(self, "export_scale_custom_var"):
                s["export_scale_custom"] = self.export_scale_custom_var.get()
            if hasattr(self, "trend_opacity_var"):
                s["trend_opacity"] = self.trend_opacity_var.get()
            if hasattr(self, "highlight_color_var"):
                s["highlight_color"] = self.highlight_color_var.get()
            with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
                json.dump(s, f, indent=2)
        except Exception:
            pass

    def run(self):
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)
        self.root.mainloop()

    def _on_close(self):
        self._save_settings()
        self.root.destroy()


def main():
    app = TokenColorMapperApp()
    app.run()


if __name__ == "__main__":
    main()
