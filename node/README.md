# Token Color Mapper — Desktop

A standalone **Windows desktop application** that turns text into colored pixel maps. Each token (word, character, line, or custom segment) is assigned a color and arranged on a 2D or 3D canvas. Built with Electron for local file access, high-resolution export, and native menus.

---

## What It Does

You paste or open text, choose how to split it into tokens and how to map tokens to colors, then view the result as:

- A **2D pixel grid** (with optional shape and arrangement)
- A **3D view** of the same grid as cubes in space
- An **RGB 3D view** where each token is a point at its color’s (R,G,B) position in color space

You can emphasize similar colors, highlight “trends” (runs of similar colors in rows, columns, or diagonals), and export high-resolution images and videos.

---

## Features

### Text & Tokenization

| Option | Description |
|--------|-------------|
| **Words** | Split on whitespace (default). |
| **Characters** | One token per character (excluding pure whitespace). |
| **Lines** | One token per line. |
| **Custom** | Split by a regex (e.g. `,`, `\|`, `;`). |

### Color Mapping

| Mode | Behavior |
|------|----------|
| **Standard (Deterministic)** | Same token always gets the same color (hash-based). |
| **Random** | Each token gets a random color. Use “Re-randomize Colors” to try again. |

### Canvas Layout

- **Pixel size** — 1–50 px per block (controls grid density).
- **Shape** — Square grid, wide rectangle, tall rectangle, circle, spiral, triangle.
- **Arrangement** — Row major, column major, spiral in/out, zigzag (row or column), diagonal, random.

### Visual Options (work with large texts)

- **Emphasize color similarity** — Groups similar colors into one (threshold 0–100%). Uses fast RGB quantization.
- **Highlight pixel trends** — Highlights runs of similar colors in horizontal, vertical, and/or diagonal directions. Configurable min length, similarity threshold, opacity, and highlight color.

### Views

- **2D canvas** — Default pixel grid.
- **3D view** — Same layout as cubes in 3D; optional path lines; mouse drag to rotate, scroll to zoom.
- **RGB 3D view** — Each token at (R,G,B) in a 0–255 cube; sphere or cube shape; optional path.

### Export

- **Image** — PNG at 2×, 4×, 8×, 16×, 32×, 64×, 128×, 256×, or **custom** scale (1–512). Max dimension 32,768 px.
- **Video** — Animated 3D plotting as WebM. Resolutions: 1080p, 2K, 4K, 8K, or **custom** width×height (up to 16,384). Enable 3D view first, then use the always-visible “Video export” section.
- **Color mapping** — JSON file of token → hex color for reuse or import.

### File & Menus

- **Open** text from `.txt`, `.md`, `.json`.
- **Save** current text to a file.
- **Import** color mapping from JSON (applies to current text).
- **Export** image / color mapping (JSON) via menu or buttons.
- **Settings** — Options are saved and restored on next launch.

---

## Requirements

- **Windows** 10 or later (target platform).
- **Node.js** LTS (e.g. 18 or 20) — only needed to run from source or build.

---

## Run from Source

1. Install [Node.js](https://nodejs.org/) (LTS) if needed.
2. Open a terminal in the app folder and install dependencies:

   ```bash
   cd path\to\desktop-app
   npm install
   ```

3. Start the app:

   ```bash
   npm start
   ```

---

## Build for Windows

From the same folder:

```bash
npm run dist
```

Outputs go to `dist/`:

| Output | Description |
|--------|-------------|
| **Token Color Mapper Setup 1.0.0.exe** | NSIS installer (optional install path). |
| **Token Color Mapper 1.0.0.exe** | Portable executable (no install). |

---

## Usage Overview

1. **Enter text** — Type or paste in the text area, or use **File → Open Text File…** (or **Open File…**).
2. **Tokenize** — Choose Words, Characters, Lines, or Custom (with regex).
3. **Color mode** — Standard (deterministic) or Random.
4. **Layout** — Set pixel size, canvas shape, and arrangement pattern.
5. **Optional** — Enable “Emphasize Color Similarity” and/or “Highlight Pixel Trends” and tune their settings.
6. **View** — Use 2D canvas, or switch to 3D view / RGB 3D view.
7. **Export** — Use **Export High-Res Image**, **Start Video Export** (with 3D view on), or **Download Color Mapping (JSON)**. Image scale and video resolution are in the controls; use the **File** menu for save dialogs where supported.

---

## Performance (large text)

The app is tuned to handle large inputs (e.g. whole books or long logs) without freezing:

- **2D preview** — Pixels are drawn with a single `ImageData` buffer and one `putImageData` call instead of thousands of `fillRect` calls. For very large grids the preview is scaled down (max 1200 px per side) so the UI stays responsive; export still uses full resolution.
- **Random arrangement** — Positions are shuffled once (O(n)) instead of “pick random until free” (O(n²) with many collisions).
- **Trend detection** — Uses a prebuilt position→color map for O(1) lookups; trend highlights use a row,col→draw map so no per-cell array search.
- **Text input** — Typing is debounced (250 ms) so each keystroke doesn’t trigger a full re-render.
- **3D / RGB 3D** — One `InstancedMesh` for all points and one path line; similarity emphasis uses RGB quantization (O(n)).

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Ctrl+O** | Open text file |
| **Ctrl+Shift+S** | Save text as |
| **Ctrl+S** | Export image |
| **Ctrl+E** | Export color mapping (JSON) |
| **Ctrl+R** | Reload window |
| **Ctrl+Z / Ctrl+Y** | Undo / Redo |
| **Ctrl+X / C / V / A** | Cut / Copy / Paste / Select all |
| **F11** | Toggle full screen |
| **F12** | Toggle developer tools |

---

## Video Export

- The **Video export** block is always visible in the controls.
- **Enable RGB 3D View (Color Space)** first, then choose resolution and speed and click **Start Video Export**.
- Recording captures the **3D color space** view: points appear in sequence at their (R,G,B) positions in the RGB cube (1080p–8K or custom).
- When finished, the app uses a save dialog (desktop) or download; output is WebM.

---

## Performance & Large Texts

- **Emphasize color similarity** uses RGB quantization (linear in number of tokens), so it scales to large texts.
- **Highlight pixel trends** uses a prebuilt position→color map so lookups are constant time; large grids remain responsive.
- For very large token counts or high export scales, image/video export may take longer and use more memory; the 32,768 px image cap helps avoid instability.

---

## Project Structure

```
desktop-app/
├── main.js          # Electron main process (window, menu, file dialogs, IPC)
├── preload.js       # Exposes desktopAPI to renderer (file I/O, menu events)
├── index.html       # UI layout and controls
├── style.css        # Styles
├── app.js           # All app logic (tokenize, color, layout, 2D/3D, export)
├── package.json     # Dependencies and build config
└── README.md        # This file
```

---

## Tech Stack

- **Electron** — Desktop shell, menus, native dialogs.
- **Three.js** — 3D view and RGB color-space view.
- **Vanilla JS** — No front-end framework; settings stored in `localStorage`.

---

## License

MIT.
