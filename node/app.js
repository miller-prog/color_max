// State management
let tokenColorMap = new Map();
let currentMode = 'standard';
let pixelSize = 10;
let tokens = [];
let emphasizeSimilarity = false;
let similarityThreshold = 50;
let highlightTrends = false;
let trendHorizontal = true;
let trendVertical = true;
let trendDiagonal = true;
let trendMinLength = 3;
let trendSimilarity = 30;
let trendOpacity = 50;
let highlightColorHex = '#ffff00';
let canvasShape = 'square';
let arrangementPattern = 'row-major';
let tokenizeMode = 'words';
let customSeparator = ',';
let exportScale = 4;
let pixelPositions = []; // Array of {row, col, x, y} for each token
let view3D = false;
let scene3D, camera3D, renderer3D, controls3D;
let pointSize3D = 0.1;
let showLines3D = false;
let plotSpeed3D = 1; // points per frame
let viewRGB3D = false;
let sceneRGB3D, cameraRGB3D, rendererRGB3D, controlsRGB3D;
let rgb3DShape = 'sphere';
let rgb3DShowPath = false;
let animationIdRGB3D;
let isRecordingVideo = false;
let mediaRecorder = null;
let recordedChunks = [];
let animationFrameId = null;

// DOM elements
const textInput = document.getElementById('textInput');
const modeSelect = document.getElementById('modeSelect');
const pixelSizeSlider = document.getElementById('pixelSize');
const pixelSizeValue = document.getElementById('pixelSizeValue');
const emphasizeSimilarityCheckbox = document.getElementById('emphasizeSimilarity');
const similarityThresholdGroup = document.getElementById('similarityThresholdGroup');
const similarityThresholdSlider = document.getElementById('similarityThreshold');
const similarityThresholdValue = document.getElementById('similarityThresholdValue');
const highlightTrendsCheckbox = document.getElementById('highlightTrends');
const trendControlsGroup = document.getElementById('trendControlsGroup');
const trendHorizontalCheckbox = document.getElementById('trendHorizontal');
const trendVerticalCheckbox = document.getElementById('trendVertical');
const trendDiagonalCheckbox = document.getElementById('trendDiagonal');
const trendMinLengthSlider = document.getElementById('trendMinLength');
const trendMinLengthValue = document.getElementById('trendMinLengthValue');
const trendSimilaritySlider = document.getElementById('trendSimilarity');
const trendSimilarityValue = document.getElementById('trendSimilarityValue');
const trendOpacitySlider = document.getElementById('trendOpacity');
const trendOpacityValue = document.getElementById('trendOpacityValue');
const highlightColorInput = document.getElementById('highlightColor');
const view3DCheckbox = document.getElementById('view3D');
const canvasShapeSelect = document.getElementById('canvasShape');
const arrangementPatternSelect = document.getElementById('arrangementPattern');
const randomizeBtn = document.getElementById('randomizeBtn');
const exportImageBtn = document.getElementById('exportImageBtn');
const downloadJsonBtn = document.getElementById('downloadJsonBtn');
const canvas = document.getElementById('colorCanvas');
const ctx = canvas.getContext('2d');
const tokenizeModeSelect = document.getElementById('tokenizeMode');
const customSepGroup = document.getElementById('customSepGroup');
const customSeparatorInput = document.getElementById('customSeparator');
const exportScaleSelect = document.getElementById('exportScale');
const exportScaleCustomGroup = document.getElementById('exportScaleCustomGroup');
const exportScaleCustomInput = document.getElementById('exportScaleCustom');
const videoExportResSelect = document.getElementById('videoExportRes');
const videoExportCustomGroup = document.getElementById('videoExportCustomGroup');
const videoExportWidthInput = document.getElementById('videoExportWidth');
const videoExportHeightInput = document.getElementById('videoExportHeight');
const openFileBtn = document.getElementById('openFileBtn');
const saveTextBtn = document.getElementById('saveTextBtn');
const canvas3DContainer = document.getElementById('canvas3D');
const canvasRGB3DContainer = document.getElementById('canvasRGB3D');
const viewRGB3DCheckbox = document.getElementById('viewRGB3D');
const rgb3DControlsGroup = document.getElementById('rgb3DControlsGroup');
const rgb3DShapeSelect = document.getElementById('rgb3DShape');
const rgb3DShowPathCheckbox = document.getElementById('rgb3DShowPath');
const view3DControlsGroup = document.getElementById('view3DControlsGroup');
const pointSize3DSlider = document.getElementById('pointSize3D');
const pointSize3DValue = document.getElementById('pointSize3DValue');
const showLines3DCheckbox = document.getElementById('showLines3D');
const plotSpeed3DSlider = document.getElementById('plotSpeed3D');
const plotSpeed3DValue = document.getElementById('plotSpeed3DValue');
const startVideoExportBtn = document.getElementById('startVideoExportBtn');

// Hash function for deterministic color mapping (standard mode)
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

// Generate HEX color from hash
function hashToColor(hash) {
    // Use hash to generate RGB values
    const r = (hash & 0xFF0000) >> 16;
    const g = (hash & 0x00FF00) >> 8;
    const b = hash & 0x0000FF;
    
    // Ensure minimum brightness for visibility
    const minBrightness = 50;
    const adjustedR = Math.max(r, minBrightness);
    const adjustedG = Math.max(g, minBrightness);
    const adjustedB = Math.max(b, minBrightness);
    
    return `#${adjustedR.toString(16).padStart(2, '0')}${adjustedG.toString(16).padStart(2, '0')}${adjustedB.toString(16).padStart(2, '0')}`;
}

// Generate random HEX color
function generateRandomColor() {
    const r = Math.floor(Math.random() * 206) + 50; // 50-255 for visibility
    const g = Math.floor(Math.random() * 206) + 50;
    const b = Math.floor(Math.random() * 206) + 50;
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Convert HEX color to RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// Convert RGB to HEX
function rgbToHex(r, g, b) {
    return `#${[r, g, b].map(x => {
        const hex = Math.round(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('')}`;
}

// Calculate color distance (Euclidean distance in RGB space)
function colorDistance(color1, color2) {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    if (!rgb1 || !rgb2) return Infinity;
    
    const dr = rgb1.r - rgb2.r;
    const dg = rgb1.g - rgb2.g;
    const db = rgb1.b - rgb2.b;
    
    return Math.sqrt(dr * dr + dg * dg + db * db);
}

// Get maximum possible color distance (for normalization)
function getMaxColorDistance() {
    // Distance between black and white
    return Math.sqrt(255 * 255 * 3);
}

// Cluster similar colors together (O(n) via RGB quantization - works with large texts)
function emphasizeSimilarColors(colorMap, threshold) {
    if (!emphasizeSimilarity || threshold === 0) {
        return new Map(colorMap);
    }
    const maxDistance = getMaxColorDistance();
    const thresholdDistance = (threshold / 100) * maxDistance;
    // Bin size so that any two colors in the same bin are within threshold
    const step = Math.max(1, Math.floor(thresholdDistance / Math.sqrt(3)));
    const bins = new Map(); // key -> { tokens: [], totalR, totalG, totalB, count }
    colorMap.forEach((color, token) => {
        const rgb = hexToRgb(color);
        if (!rgb) return;
        const bi = Math.min(255, Math.floor(rgb.r / step));
        const bj = Math.min(255, Math.floor(rgb.g / step));
        const bk = Math.min(255, Math.floor(rgb.b / step));
        const key = `${bi},${bj},${bk}`;
        if (!bins.has(key)) {
            bins.set(key, { tokens: [], totalR: 0, totalG: 0, totalB: 0, count: 0 });
        }
        const b = bins.get(key);
        b.tokens.push(token);
        b.totalR += rgb.r;
        b.totalG += rgb.g;
        b.totalB += rgb.b;
        b.count += 1;
    });
    const adjustedMap = new Map();
    bins.forEach((b) => {
        const avgR = b.totalR / b.count;
        const avgG = b.totalG / b.count;
        const avgB = b.totalB / b.count;
        const avgColor = rgbToHex(avgR, avgG, avgB);
        b.tokens.forEach((token) => adjustedMap.set(token, avgColor));
    });
    return adjustedMap;
}

// Get effective export scale (1–512), including custom input
function getExportScale() {
    if (!exportScaleSelect) return 4;
    const v = exportScaleSelect.value;
    if (v === 'custom' && exportScaleCustomInput) {
        const n = parseInt(exportScaleCustomInput.value, 10);
        return Math.min(512, Math.max(1, isNaN(n) ? 64 : n));
    }
    const n = parseInt(v, 10);
    return isNaN(n) ? 4 : Math.min(512, Math.max(1, n));
}

// Get video export resolution { width, height }
function getVideoExportSize() {
    if (!videoExportResSelect) return { width: 1920, height: 1080 };
    const v = videoExportResSelect.value;
    if (v === 'custom' && videoExportWidthInput && videoExportHeightInput) {
        const w = parseInt(videoExportWidthInput.value, 10) || 1920;
        const h = parseInt(videoExportHeightInput.value, 10) || 1080;
        return { width: Math.min(16384, Math.max(320, w)), height: Math.min(16384, Math.max(240, h)) };
    }
    const [w, h] = (v || '1920x1080').split('x').map(s => parseInt(s, 10));
    return { width: w || 1920, height: h || 1080 };
}

// Tokenize text input (supports words, chars, lines, custom separator)
function tokenize(text) {
    if (!text || (typeof text !== 'string')) return [];
    const raw = text.trim();
    if (!raw) return [];
    const mode = tokenizeModeSelect ? tokenizeModeSelect.value : 'words';
    const sep = customSeparatorInput ? (customSeparatorInput.value || ',') : ',';
    if (mode === 'words') {
        return raw.split(/\s+/).filter(t => t.length > 0);
    }
    if (mode === 'chars') {
        return raw.split('').filter(c => c.trim().length > 0 || c === ' ');
    }
    if (mode === 'lines') {
        return raw.split(/\r?\n/).filter(t => t.length > 0);
    }
    if (mode === 'custom') {
        try {
            const re = new RegExp(sep, 'g');
            return raw.split(re).map(t => t.trim()).filter(t => t.length > 0);
        } catch (_) {
            return raw.split(sep).map(t => t.trim()).filter(t => t.length > 0);
        }
    }
    return raw.split(/\s+/).filter(t => t.length > 0);
}

// Get or create color for a token
function getColorForToken(token, mode) {
    if (tokenColorMap.has(token)) {
        return tokenColorMap.get(token);
    }
    
    let color;
    if (mode === 'standard') {
        const hash = hashString(token);
        color = hashToColor(hash);
    } else {
        color = generateRandomColor();
    }
    
    tokenColorMap.set(token, color);
    return color;
}

// Calculate canvas dimensions based on shape
function calculateCanvasSize(tokens, pixelSize, shape) {
    if (tokens.length === 0) {
        return { width: 0, height: 0, cols: 0, rows: 0, centerX: 0, centerY: 0, radius: 0 };
    }
    
    let cols, rows, width, height, centerX, centerY, radius;
    
    switch (shape) {
        case 'square':
            cols = Math.ceil(Math.sqrt(tokens.length));
            rows = Math.ceil(tokens.length / cols);
            width = cols * pixelSize;
            height = rows * pixelSize;
            break;
        case 'rectangle':
            // Wide rectangle (2:1 aspect ratio)
            cols = Math.ceil(Math.sqrt(tokens.length * 2));
            rows = Math.ceil(tokens.length / cols);
            width = cols * pixelSize;
            height = rows * pixelSize;
            break;
        case 'tall':
            // Tall rectangle (1:2 aspect ratio)
            rows = Math.ceil(Math.sqrt(tokens.length * 2));
            cols = Math.ceil(tokens.length / rows);
            width = cols * pixelSize;
            height = rows * pixelSize;
            break;
        case 'circle':
            // Calculate radius needed to fit all tokens
            const area = tokens.length;
            radius = Math.ceil(Math.sqrt(area / Math.PI)) * pixelSize;
            width = height = radius * 2 + pixelSize;
            centerX = width / 2;
            centerY = height / 2;
            // Estimate grid size for circle
            cols = Math.ceil(Math.sqrt(tokens.length));
            rows = Math.ceil(tokens.length / cols);
            break;
        case 'spiral':
            // Square canvas for spiral
            cols = Math.ceil(Math.sqrt(tokens.length));
            rows = Math.ceil(tokens.length / cols);
            width = cols * pixelSize;
            height = rows * pixelSize;
            centerX = width / 2;
            centerY = height / 2;
            break;
        case 'triangle':
            // Calculate triangular grid size
            let n = 1;
            while (n * (n + 1) / 2 < tokens.length) n++;
            cols = n;
            rows = n;
            width = cols * pixelSize;
            height = rows * pixelSize;
            break;
        default:
            cols = Math.ceil(Math.sqrt(tokens.length));
            rows = Math.ceil(tokens.length / cols);
            width = cols * pixelSize;
            height = rows * pixelSize;
    }
    
    return {
        width, height, cols, rows,
        centerX: centerX || width / 2,
        centerY: centerY || height / 2,
        radius: radius || Math.min(width, height) / 2
    };
}

// Generate pixel positions based on arrangement pattern
function generatePixelPositions(tokens, canvasInfo, pattern) {
    const positions = [];
    const { cols, rows, width, height, centerX, centerY, radius } = canvasInfo;
    
    if (pattern === 'row-major') {
        // Left to right, top to bottom
        tokens.forEach((token, index) => {
            const row = Math.floor(index / cols);
            const col = index % cols;
            positions.push({
                token,
                row,
                col,
                x: col * pixelSize,
                y: row * pixelSize,
                valid: true
            });
        });
    } else if (pattern === 'column-major') {
        // Top to bottom, left to right
        tokens.forEach((token, index) => {
            const col = Math.floor(index / rows);
            const row = index % rows;
            positions.push({
                token,
                row,
                col,
                x: col * pixelSize,
                y: row * pixelSize,
                valid: true
            });
        });
    } else if (pattern === 'spiral-in') {
        // Spiral from outside in
        const grid = Array(rows).fill(null).map(() => Array(cols).fill(null));
        let currentRow = 0, currentCol = 0;
        let minRow = 0, maxRow = rows - 1;
        let minCol = 0, maxCol = cols - 1;
        let direction = 0; // 0: right, 1: down, 2: left, 3: up
        
        for (let i = 0; i < tokens.length; i++) {
            grid[currentRow][currentCol] = i;
            
            if (direction === 0) {
                if (currentCol >= maxCol) {
                    direction = 1;
                    minRow++;
                    currentRow++;
                } else {
                    currentCol++;
                }
            } else if (direction === 1) {
                if (currentRow >= maxRow) {
                    direction = 2;
                    maxCol--;
                    currentCol--;
                } else {
                    currentRow++;
                }
            } else if (direction === 2) {
                if (currentCol <= minCol) {
                    direction = 3;
                    maxRow--;
                    currentRow--;
                } else {
                    currentCol--;
                }
            } else {
                if (currentRow <= minRow) {
                    direction = 0;
                    minCol++;
                    currentCol++;
                } else {
                    currentRow--;
                }
            }
        }
        
        grid.forEach((row, r) => {
            row.forEach((index, c) => {
                if (index !== null && index < tokens.length) {
                    positions.push({
                        token: tokens[index],
                        row: r,
                        col: c,
                        x: c * pixelSize,
                        y: r * pixelSize,
                        valid: true
                    });
                }
            });
        });
    } else if (pattern === 'spiral-out') {
        // Spiral from center outward
        const grid = Array(rows).fill(null).map(() => Array(cols).fill(null));
        const startRow = Math.floor(rows / 2);
        const startCol = Math.floor(cols / 2);
        let currentRow = startRow, currentCol = startCol;
        let step = 1;
        let stepCount = 0;
        let direction = 0; // 0: right, 1: up, 2: left, 3: down
        let index = 0;
        
        // Place first token at center
        if (index < tokens.length && currentRow >= 0 && currentRow < rows && currentCol >= 0 && currentCol < cols) {
            grid[currentRow][currentCol] = index++;
        }
        
        while (index < tokens.length) {
            // Move in current direction
            if (direction === 0) currentCol++;
            else if (direction === 1) currentRow--;
            else if (direction === 2) currentCol--;
            else currentRow++;
            
            stepCount++;
            
            // Place token if valid position
            if (currentRow >= 0 && currentRow < rows && currentCol >= 0 && currentCol < cols && index < tokens.length) {
                grid[currentRow][currentCol] = index++;
            }
            
            // Change direction when step count reached
            if (stepCount >= step) {
                stepCount = 0;
                direction = (direction + 1) % 4;
                if (direction === 0 || direction === 2) {
                    step++;
                }
            }
        }
        
        grid.forEach((row, r) => {
            row.forEach((tokenIndex, c) => {
                if (tokenIndex !== null && tokenIndex < tokens.length) {
                    positions.push({
                        token: tokens[tokenIndex],
                        row: r,
                        col: c,
                        x: c * pixelSize,
                        y: r * pixelSize,
                        valid: true
                    });
                }
            });
        });
    } else if (pattern === 'zigzag') {
        // Zigzag row by row
        tokens.forEach((token, index) => {
            const row = Math.floor(index / cols);
            const col = index % cols;
            const actualCol = row % 2 === 0 ? col : cols - 1 - col;
            positions.push({
                token,
                row,
                col: actualCol,
                x: actualCol * pixelSize,
                y: row * pixelSize,
                valid: true
            });
        });
    } else if (pattern === 'zigzag-col') {
        // Zigzag column by column
        tokens.forEach((token, index) => {
            const col = Math.floor(index / rows);
            const row = index % rows;
            const actualRow = col % 2 === 0 ? row : rows - 1 - row;
            positions.push({
                token,
                row: actualRow,
                col,
                x: col * pixelSize,
                y: actualRow * pixelSize,
                valid: true
            });
        });
    } else if (pattern === 'diagonal') {
        // Diagonal from top-left to bottom-right
        const grid = Array(rows).fill(null).map(() => Array(cols).fill(null));
        let index = 0;
        
        for (let sum = 0; sum < rows + cols - 1 && index < tokens.length; sum++) {
            for (let row = 0; row < rows && index < tokens.length; row++) {
                const col = sum - row;
                if (col >= 0 && col < cols) {
                    grid[row][col] = index++;
                }
            }
        }
        
        grid.forEach((row, r) => {
            row.forEach((tokenIndex, c) => {
                if (tokenIndex !== null && tokenIndex < tokens.length) {
                    positions.push({
                        token: tokens[tokenIndex],
                        row: r,
                        col: c,
                        x: c * pixelSize,
                        y: r * pixelSize,
                        valid: true
                    });
                }
            });
        });
    } else if (pattern === 'random') {
        // Random positions: shuffle all (row,col) then assign first N (O(n), no collision loop)
        const cells = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) cells.push({ row: r, col: c });
        }
        for (let i = cells.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = cells[i]; cells[i] = cells[j]; cells[j] = t;
        }
        tokens.forEach((token, index) => {
            const { row, col } = cells[index];
            positions.push({
                token,
                row,
                col,
                x: col * pixelSize,
                y: row * pixelSize,
                valid: true
            });
        });
    }
    
    return positions;
}

// Check if position is valid for canvas shape
function isValidPosition(pos, canvasInfo, shape) {
    if (!pos.valid) return false;
    
    const { cols, rows, centerX, centerY, radius } = canvasInfo;
    const { row, col, x, y } = pos;
    
    switch (shape) {
        case 'circle':
            const dx = x + pixelSize / 2 - centerX;
            const dy = y + pixelSize / 2 - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance <= radius;
        case 'triangle':
            // Triangular shape: row determines how many columns are valid
            return col <= row;
        default:
            return row >= 0 && row < rows && col >= 0 && col < cols;
    }
}

// Get color at grid position (O(1) when positionColorMap provided, else O(n) lookup)
function getColorAtPosition(displayColorMap, row, col, positionColorMap) {
    if (positionColorMap && positionColorMap.has(row + ',' + col)) {
        return positionColorMap.get(row + ',' + col);
    }
    const pos = pixelPositions.find(p => p.row === row && p.col === col && p.valid);
    if (pos) {
        return displayColorMap.get(pos.token) || tokenColorMap.get(pos.token);
    }
    return null;
}

// Build row,col -> color map for O(1) trend detection (handles large grids)
function buildPositionColorMap(displayColorMap) {
    const m = new Map();
    for (let i = 0; i < pixelPositions.length; i++) {
        const p = pixelPositions[i];
        if (p.valid) {
            m.set(p.row + ',' + p.col, displayColorMap.get(p.token) || tokenColorMap.get(p.token));
        }
    }
    return m;
}

// Detect trends in a specific direction (use positionColorMap for large texts)
function detectTrends(displayColorMap, cols, rows, direction, positionColorMap) {
    const trends = [];
    const maxDistance = getMaxColorDistance();
    const thresholdDistance = (trendSimilarity / 100) * maxDistance;
    const getColor = (r, c) => getColorAtPosition(displayColorMap, r, c, positionColorMap);

    if (direction === 'horizontal') {
        // Check horizontal trends (left to right)
        for (let row = 0; row < rows; row++) {
            let currentTrend = [];
            let lastColor = null;

            for (let col = 0; col < cols; col++) {
                const color = getColor(row, col);
                if (!color) continue;
                
                if (lastColor === null) {
                    currentTrend.push({ row, col, color });
                    lastColor = color;
                } else {
                    const distance = colorDistance(color, lastColor);
                    if (distance <= thresholdDistance) {
                        currentTrend.push({ row, col, color });
                    } else {
                        if (currentTrend.length >= trendMinLength) {
                            trends.push(currentTrend);
                        }
                        currentTrend = [{ row, col, color }];
                        lastColor = color;
                    }
                }
            }
            
            if (currentTrend.length >= trendMinLength) {
                trends.push(currentTrend);
            }
        }
    } else if (direction === 'vertical') {
        // Check vertical trends (top to bottom)
        for (let col = 0; col < cols; col++) {
            let currentTrend = [];
            let lastColor = null;
            
            for (let row = 0; row < rows; row++) {
                const color = getColor(row, col);
                if (!color) continue;
                
                if (lastColor === null) {
                    currentTrend.push({ row, col, color });
                    lastColor = color;
                } else {
                    const distance = colorDistance(color, lastColor);
                    if (distance <= thresholdDistance) {
                        currentTrend.push({ row, col, color });
                    } else {
                        if (currentTrend.length >= trendMinLength) {
                            trends.push(currentTrend);
                        }
                        currentTrend = [{ row, col, color }];
                        lastColor = color;
                    }
                }
            }
            
            if (currentTrend.length >= trendMinLength) {
                trends.push(currentTrend);
            }
        }
    } else if (direction === 'diagonal') {
        // Check diagonal trends (top-left to bottom-right)
        // Check main diagonals
        for (let startRow = 0; startRow < rows; startRow++) {
            let currentTrend = [];
            let lastColor = null;
            
            for (let offset = 0; offset < Math.min(rows - startRow, cols); offset++) {
                const row = startRow + offset;
                const col = offset;
                const color = getColor(row, col);
                if (!color) continue;
                
                if (lastColor === null) {
                    currentTrend.push({ row, col, color });
                    lastColor = color;
                } else {
                    const distance = colorDistance(color, lastColor);
                    if (distance <= thresholdDistance) {
                        currentTrend.push({ row, col, color });
                    } else {
                        if (currentTrend.length >= trendMinLength) {
                            trends.push(currentTrend);
                        }
                        currentTrend = [{ row, col, color }];
                        lastColor = color;
                    }
                }
            }
            
            if (currentTrend.length >= trendMinLength) {
                trends.push(currentTrend);
            }
        }
        
        // Check diagonals starting from left edge
        for (let startCol = 1; startCol < cols; startCol++) {
            let currentTrend = [];
            let lastColor = null;
            
            for (let offset = 0; offset < Math.min(rows, cols - startCol); offset++) {
                const row = offset;
                const col = startCol + offset;
                const color = getColor(row, col);
                if (!color) continue;
                
                if (lastColor === null) {
                    currentTrend.push({ row, col, color });
                    lastColor = color;
                } else {
                    const distance = colorDistance(color, lastColor);
                    if (distance <= thresholdDistance) {
                        currentTrend.push({ row, col, color });
                    } else {
                        if (currentTrend.length >= trendMinLength) {
                            trends.push(currentTrend);
                        }
                        currentTrend = [{ row, col, color }];
                        lastColor = color;
                    }
                }
            }
            
            if (currentTrend.length >= trendMinLength) {
                trends.push(currentTrend);
            }
        }
        
        // Check anti-diagonals (top-right to bottom-left)
        for (let startRow = 0; startRow < rows; startRow++) {
            let currentTrend = [];
            let lastColor = null;
            
            for (let offset = 0; offset < Math.min(rows - startRow, cols); offset++) {
                const row = startRow + offset;
                const col = cols - 1 - offset;
                const color = getColor(row, col);
                if (!color) continue;
                
                if (lastColor === null) {
                    currentTrend.push({ row, col, color });
                    lastColor = color;
                } else {
                    const distance = colorDistance(color, lastColor);
                    if (distance <= thresholdDistance) {
                        currentTrend.push({ row, col, color });
                    } else {
                        if (currentTrend.length >= trendMinLength) {
                            trends.push(currentTrend);
                        }
                        currentTrend = [{ row, col, color }];
                        lastColor = color;
                    }
                }
            }
            
            if (currentTrend.length >= trendMinLength) {
                trends.push(currentTrend);
            }
        }
        
        // Check anti-diagonals starting from right edge
        for (let startCol = cols - 2; startCol >= 0; startCol--) {
            let currentTrend = [];
            let lastColor = null;
            
            for (let offset = 0; offset < Math.min(rows, startCol + 1); offset++) {
                const row = offset;
                const col = startCol - offset;
                const color = getColor(row, col);
                if (!color) continue;
                
                if (lastColor === null) {
                    currentTrend.push({ row, col, color });
                    lastColor = color;
                } else {
                    const distance = colorDistance(color, lastColor);
                    if (distance <= thresholdDistance) {
                        currentTrend.push({ row, col, color });
                    } else {
                        if (currentTrend.length >= trendMinLength) {
                            trends.push(currentTrend);
                        }
                        currentTrend = [{ row, col, color }];
                        lastColor = color;
                    }
                }
            }
            
            if (currentTrend.length >= trendMinLength) {
                trends.push(currentTrend);
            }
        }
    }
    
    return trends;
}

// Convert hex to RGB
function hexToRgbForHighlight(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 0 };
}

// Draw trend highlights on canvas (positionToDrawMap: row,col -> {x,y,size} for O(1) lookup)
function drawTrendHighlights(trends, positionToDrawMap) {
    if (!highlightTrends || trends.length === 0) return;
    const map = positionToDrawMap || buildRowColToDrawMap(pixelPositions, pixelSize, 1);
    
    const rgb = hexToRgbForHighlight(highlightColorHex);
    const highlightColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${trendOpacity / 100})`;
    const borderColor = `rgba(${Math.max(0, rgb.r - 55)}, ${Math.max(0, rgb.g - 55)}, ${Math.max(0, rgb.b - 55)}, ${Math.min(trendOpacity / 100 + 0.2, 1)})`;
    
    trends.forEach(trend => {
        trend.forEach(({ row, col }) => {
            const d = map.get(row + ',' + col);
            if (!d) return;
            ctx.fillStyle = highlightColor;
            ctx.fillRect(d.x, d.y, d.size, d.size);
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(d.x, d.y, d.size, d.size);
        });
    });
}

function buildRowColToDrawMap(positions, pixelSize, drawScale) {
    const map = new Map();
    const scale = drawScale || 1;
    for (let i = 0; i < positions.length; i++) {
        const p = positions[i];
        if (!p.valid) continue;
        const size = Math.max(1, Math.floor(pixelSize * scale));
        const x = Math.floor(p.x * scale);
        const y = Math.floor(p.y * scale);
        map.set(p.row + ',' + p.col, { x, y, size });
    }
    return map;
}

// Initialize 3D view
function init3DView() {
    if (!window.THREE) {
        console.error('Three.js not loaded');
        return;
    }
    
    // Clear existing scene if any
    if (scene3D) {
        while(scene3D.children.length > 0) {
            scene3D.remove(scene3D.children[0]);
        }
    }
    
    scene3D = new THREE.Scene();
    scene3D.background = new THREE.Color(0x1a1a1a);
    
    // Camera
    const container = canvas3DContainer;
    const width = container.clientWidth;
    const height = container.clientHeight || 600;
    
    camera3D = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera3D.position.set(0, 0, 5);
    
    // Renderer
    if (renderer3D) {
        renderer3D.dispose();
    }
    renderer3D = new THREE.WebGLRenderer({ antialias: true });
    renderer3D.setSize(width, height);
    renderer3D.setPixelRatio(window.devicePixelRatio);
    canvas3DContainer.innerHTML = '';
    canvas3DContainer.appendChild(renderer3D.domElement);
    
    // Simple mouse controls for rotation and zoom
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let mouseDown = false;
    
    const onMouseDown = (e) => {
        isDragging = true;
        mouseDown = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    };
    
    let rotationX = 0;
    let rotationY = 0;
    const onMouseMove = (e) => {
        if (!isDragging || !mouseDown) return;
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;
        
        rotationY += deltaX * 0.01;
        rotationX += deltaY * 0.01;
        rotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationX));
        
        const radius = camera3D.position.length();
        camera3D.position.x = radius * Math.sin(rotationY) * Math.cos(rotationX);
        camera3D.position.y = radius * Math.sin(rotationX);
        camera3D.position.z = radius * Math.cos(rotationY) * Math.cos(rotationX);
        camera3D.lookAt(0, 0, 0);
        
        previousMousePosition = { x: e.clientX, y: e.clientY };
    };
    
    const onMouseUp = () => {
        isDragging = false;
        mouseDown = false;
    };
    
    const onWheel = (e) => {
        e.preventDefault();
        const direction = e.deltaY > 0 ? 1 : -1;
        camera3D.position.multiplyScalar(1 + direction * 0.1);
    };
    
    renderer3D.domElement.addEventListener('mousedown', onMouseDown);
    renderer3D.domElement.addEventListener('mousemove', onMouseMove);
    renderer3D.domElement.addEventListener('mouseup', onMouseUp);
    renderer3D.domElement.addEventListener('mouseleave', onMouseUp);
    renderer3D.domElement.addEventListener('wheel', onWheel);
    
    controls3D = {
        update: function() {},
        dispose: function() {
            renderer3D.domElement.removeEventListener('mousedown', onMouseDown);
            renderer3D.domElement.removeEventListener('mousemove', onMouseMove);
            renderer3D.domElement.removeEventListener('mouseup', onMouseUp);
            renderer3D.domElement.removeEventListener('mouseleave', onMouseUp);
            renderer3D.domElement.removeEventListener('wheel', onWheel);
        }
    };
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene3D.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene3D.add(directionalLight);
}

// Initialize RGB 3D view (color space visualization)
function initRGB3DView() {
    if (!window.THREE) {
        console.error('Three.js not loaded');
        return;
    }
    
    // Clear existing scene if any
    if (sceneRGB3D) {
        while(sceneRGB3D.children.length > 0) {
            sceneRGB3D.remove(sceneRGB3D.children[0]);
        }
    }
    
    sceneRGB3D = new THREE.Scene();
    sceneRGB3D.background = new THREE.Color(0x0a0a0a);
    
    // Camera
    const container = canvasRGB3DContainer;
    const width = container.clientWidth;
    const height = container.clientHeight || 600;
    
    cameraRGB3D = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    // Position camera to view the RGB cube (0-255 range, centered at 127.5)
    cameraRGB3D.position.set(400, 400, 400);
    cameraRGB3D.lookAt(127.5, 127.5, 127.5);
    
    // Renderer
    if (rendererRGB3D) {
        rendererRGB3D.dispose();
    }
    rendererRGB3D = new THREE.WebGLRenderer({ antialias: true });
    rendererRGB3D.setSize(width, height);
    rendererRGB3D.setPixelRatio(window.devicePixelRatio);
    canvasRGB3DContainer.innerHTML = '';
    canvasRGB3DContainer.appendChild(rendererRGB3D.domElement);
    
    // Mouse controls for rotation and zoom
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let mouseDown = false;
    
    const onMouseDown = (e) => {
        isDragging = true;
        mouseDown = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    };
    
    let rotationX = 0;
    let rotationY = 0;
    const onMouseMove = (e) => {
        if (!isDragging || !mouseDown) return;
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;
        
        rotationY += deltaX * 0.01;
        rotationX += deltaY * 0.01;
        rotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationX));
        
        const radius = 400;
        const center = new THREE.Vector3(127.5, 127.5, 127.5);
        cameraRGB3D.position.x = center.x + radius * Math.sin(rotationY) * Math.cos(rotationX);
        cameraRGB3D.position.y = center.y + radius * Math.sin(rotationX);
        cameraRGB3D.position.z = center.z + radius * Math.cos(rotationY) * Math.cos(rotationX);
        cameraRGB3D.lookAt(center);
        
        previousMousePosition = { x: e.clientX, y: e.clientY };
    };
    
    const onMouseUp = () => {
        isDragging = false;
        mouseDown = false;
    };
    
    const onWheel = (e) => {
        e.preventDefault();
        const direction = e.deltaY > 0 ? 1 : -1;
        const center = new THREE.Vector3(127.5, 127.5, 127.5);
        const directionVec = new THREE.Vector3().subVectors(cameraRGB3D.position, center).normalize();
        cameraRGB3D.position.add(directionVec.multiplyScalar(direction * 20));
    };
    
    rendererRGB3D.domElement.addEventListener('mousedown', onMouseDown);
    rendererRGB3D.domElement.addEventListener('mousemove', onMouseMove);
    rendererRGB3D.domElement.addEventListener('mouseup', onMouseUp);
    rendererRGB3D.domElement.addEventListener('mouseleave', onMouseUp);
    rendererRGB3D.domElement.addEventListener('wheel', onWheel);
    
    controlsRGB3D = {
        update: function() {},
        dispose: function() {
            rendererRGB3D.domElement.removeEventListener('mousedown', onMouseDown);
            rendererRGB3D.domElement.removeEventListener('mousemove', onMouseMove);
            rendererRGB3D.domElement.removeEventListener('mouseup', onMouseUp);
            rendererRGB3D.domElement.removeEventListener('mouseleave', onMouseUp);
            rendererRGB3D.domElement.removeEventListener('wheel', onWheel);
        }
    };
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    sceneRGB3D.add(ambientLight);
    
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(5, 5, 5);
    sceneRGB3D.add(directionalLight1);
    
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-5, -5, -5);
    sceneRGB3D.add(directionalLight2);
    
    // Add RGB axes helpers (optional, for reference)
    const axesHelper = new THREE.AxesHelper(300);
    sceneRGB3D.add(axesHelper);
    
    // Add RGB cube wireframe for reference
    const cubeGeometry = new THREE.BoxGeometry(255, 255, 255);
    const cubeEdges = new THREE.EdgesGeometry(cubeGeometry);
    const cubeLine = new THREE.LineSegments(cubeEdges, new THREE.LineBasicMaterial({ color: 0x444444 }));
    cubeLine.position.set(127.5, 127.5, 127.5);
    sceneRGB3D.add(cubeLine);
}

// Render RGB 3D canvas (color space visualization)
function renderCanvasRGB3D() {
    if (!viewRGB3D || !sceneRGB3D || !rendererRGB3D) return;
    
    tokens = tokenize(textInput.value);
    
    if (tokens.length === 0) {
        if (rendererRGB3D) {
            rendererRGB3D.render(sceneRGB3D, cameraRGB3D);
        }
        return;
    }
    
    // Get colors for all tokens
    tokens.forEach(token => {
        getColorForToken(token, currentMode);
    });
    
    // Apply color similarity emphasis if enabled
    const displayColorMap = emphasizeSimilarColors(tokenColorMap, similarityThreshold);
    
    // Clear existing token geometry (keep lights, axes, cube wireframe)
    const toRemove = [];
    sceneRGB3D.children.forEach(child => {
        if ((child instanceof THREE.Mesh || child instanceof THREE.InstancedMesh) && child.userData.isTokenPoint) {
            toRemove.push(child);
        }
        if (child instanceof THREE.Line && child.userData.isPathLine) {
            toRemove.push(child);
        }
    });
    toRemove.forEach(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material && child.material.dispose) child.material.dispose();
        sceneRGB3D.remove(child);
    });
    
    const pointSize = 5;
    const count = tokens.length;
    const points = [];
    
    // Build position/color arrays (skip invalid)
    for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index];
        const hexColor = displayColorMap.get(token) || tokenColorMap.get(token);
        const rgb = hexToRgb(hexColor);
        if (!rgb) continue;
        points.push({ x: rgb.r, y: rgb.g, z: rgb.b, color: hexColor, index });
    }
    
    const instanceCount = points.length;
    if (instanceCount === 0) {
        if (animationIdRGB3D) cancelAnimationFrame(animationIdRGB3D);
        function animate() {
            if (!viewRGB3D || !rendererRGB3D) return;
            animationIdRGB3D = requestAnimationFrame(animate);
            if (controlsRGB3D && controlsRGB3D.update) controlsRGB3D.update();
            rendererRGB3D.render(sceneRGB3D, cameraRGB3D);
        }
        animate();
        return;
    }
    
    // Single InstancedMesh for all points (handles large token counts)
    const geometry = rgb3DShape === 'sphere'
        ? new THREE.SphereGeometry(pointSize, 12, 12)
        : new THREE.BoxGeometry(pointSize * 2, pointSize * 2, pointSize * 2);
    const material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        color: 0xffffff
    });
    const instancedMesh = new THREE.InstancedMesh(geometry, material, instanceCount);
    instancedMesh.userData.isTokenPoint = true;
    instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(instanceCount * 3), 3);
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    
    for (let i = 0; i < instanceCount; i++) {
        const p = points[i];
        matrix.identity();
        matrix.setPosition(p.x, p.y, p.z);
        instancedMesh.setMatrixAt(i, matrix);
        color.set(p.color);
        instancedMesh.setColorAt(i, color);
    }
    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.instanceColor.needsUpdate = true;
    sceneRGB3D.add(instancedMesh);
    
    if (rgb3DShowPath && points.length > 1) {
        const pathGeometry = new THREE.BufferGeometry();
        const pathPositions = new Float32Array(points.length * 3);
        for (let i = 0; i < points.length; i++) {
            pathPositions[i * 3] = points[i].x;
            pathPositions[i * 3 + 1] = points[i].y;
            pathPositions[i * 3 + 2] = points[i].z;
        }
        pathGeometry.setAttribute('position', new THREE.BufferAttribute(pathPositions, 3));
        const pathLine = new THREE.Line(pathGeometry, new THREE.LineBasicMaterial({ color: 0x888888, opacity: 0.5, transparent: true }));
        pathLine.userData.isPathLine = true;
        sceneRGB3D.add(pathLine);
    }
    
    // Animate
    if (animationIdRGB3D) {
        cancelAnimationFrame(animationIdRGB3D);
    }
    function animate() {
        if (!viewRGB3D || !rendererRGB3D) return;
        
        animationIdRGB3D = requestAnimationFrame(animate);
        
        if (controlsRGB3D && controlsRGB3D.update) {
            controlsRGB3D.update();
        }
        
        rendererRGB3D.render(sceneRGB3D, cameraRGB3D);
    }
    
    animate();
}

// Render 3D canvas
function renderCanvas3D() {
    if (!view3D || !scene3D || !renderer3D) return;
    
    tokens = tokenize(textInput.value);
    
    if (tokens.length === 0) {
        if (renderer3D) {
            renderer3D.render(scene3D, camera3D);
        }
        return;
    }
    
    // Get colors for all tokens
    tokens.forEach(token => {
        getColorForToken(token, currentMode);
    });
    
    // Apply color similarity emphasis if enabled
    const displayColorMap = emphasizeSimilarColors(tokenColorMap, similarityThreshold);
    
    // Calculate canvas dimensions based on shape
    const canvasInfo = calculateCanvasSize(tokens, pixelSize, canvasShape);
    const { cols, rows } = canvasInfo;
    
    // Generate pixel positions based on arrangement pattern
    pixelPositions = generatePixelPositions(tokens, canvasInfo, arrangementPattern);
    
    // Filter positions based on canvas shape
    pixelPositions = pixelPositions.map(pos => ({
        ...pos,
        valid: isValidPosition(pos, canvasInfo, canvasShape)
    }));
    
    // Clear existing geometry (keep lights)
    while (scene3D.children.length > 2) {
        const child = scene3D.children[scene3D.children.length - 1];
        if (child.geometry) child.geometry.dispose();
        if (child.material) { const m = child.material; if (m.dispose) m.dispose(); }
        scene3D.remove(child);
    }
    
    const cubeSize = pointSize3D;
    const spacing = cubeSize * 1.2;
    const validPositions = pixelPositions.filter(pos => pos.valid);
    const count = validPositions.length;
    const positions = [];
    const rowColToIndex = new Map();
    
    if (count === 0) {
        let animationId;
        function animate() {
            if (!view3D || !renderer3D) return;
            animationId = requestAnimationFrame(animate);
            if (controls3D && controls3D.update) controls3D.update();
            renderer3D.render(scene3D, camera3D);
        }
        animate();
        return;
    }
    
    // Single shared geometry and instanced mesh (handles large token counts without freezing)
    const boxGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        color: 0xffffff
    });
    const instancedMesh = new THREE.InstancedMesh(boxGeometry, material, count);
    instancedMesh.userData.isTokenPoint = true;
    // Ensure instanceColor buffer exists (required for setColorAt to display)
    instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    
    for (let i = 0; i < count; i++) {
        const pos = validPositions[i];
        const hexColor = displayColorMap.get(pos.token) || tokenColorMap.get(pos.token);
        const x = (pos.col - cols / 2) * spacing;
        const y = (rows / 2 - pos.row) * spacing;
        const z = 0;
        
        matrix.identity();
        matrix.setPosition(x, y, z);
        instancedMesh.setMatrixAt(i, matrix);
        color.set(hexColor);
        instancedMesh.setColorAt(i, color);
        
        rowColToIndex.set(pos.row + ',' + pos.col, i);
        positions.push({ x, y, z, index: i });
    }
    
    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.instanceColor.needsUpdate = true;
    scene3D.add(instancedMesh);
    
    // Path line (one draw call)
    if (showLines3D && positions.length > 1) {
        const lineGeometry = new THREE.BufferGeometry();
        const linePositions = new Float32Array(positions.length * 3);
        for (let i = 0; i < positions.length; i++) {
            linePositions[i * 3] = positions[i].x;
            linePositions[i * 3 + 1] = positions[i].y;
            linePositions[i * 3 + 2] = positions[i].z;
        }
        lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x888888, opacity: 0.5, transparent: true });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        line.userData.isPathLine = true;
        scene3D.add(line);
    }
    
    // Trend highlights: update instance colors (no per-mesh search)
    if (highlightTrends) {
        const positionColorMap = buildPositionColorMap(displayColorMap);
        const allTrends = [];
        if (trendHorizontal) allTrends.push(...detectTrends(displayColorMap, cols, rows, 'horizontal', positionColorMap));
        if (trendVertical) allTrends.push(...detectTrends(displayColorMap, cols, rows, 'vertical', positionColorMap));
        if (trendDiagonal) allTrends.push(...detectTrends(displayColorMap, cols, rows, 'diagonal', positionColorMap));
        
        const rgb = hexToRgbForHighlight(highlightColorHex);
        const highlightColor = new THREE.Color(rgb.r / 255, rgb.g / 255, rgb.b / 255);
        allTrends.forEach(trend => {
            trend.forEach(({ row, col }) => {
                const idx = rowColToIndex.get(row + ',' + col);
                if (idx !== undefined) instancedMesh.setColorAt(idx, highlightColor);
            });
        });
        if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
    }
    
    // Animate
    let animationId;
    function animate() {
        if (!view3D || !renderer3D) return;
        
        animationId = requestAnimationFrame(animate);
        
        if (controls3D && controls3D.update) {
            controls3D.update();
        }
        
        renderer3D.render(scene3D, camera3D);
    }
    
    animate();
}

// Render tokens on canvas
function renderCanvas() {
    if (viewRGB3D) {
        renderCanvasRGB3D();
        return;
    }
    if (view3D) {
        renderCanvas3D();
        return;
    }
    
    tokens = tokenize(textInput.value);
    
    if (tokens.length === 0) {
        canvas.width = 0;
        canvas.height = 0;
        return;
    }
    
    // Get colors for all tokens
    tokens.forEach(token => {
        getColorForToken(token, currentMode);
    });
    
    // Apply color similarity emphasis if enabled
    const displayColorMap = emphasizeSimilarColors(tokenColorMap, similarityThreshold);
    
    // Calculate canvas dimensions based on shape
    const canvasInfo = calculateCanvasSize(tokens, pixelSize, canvasShape);
    const { width, height, cols, rows } = canvasInfo;
    
    // Preview cap: keep display responsive for huge token counts (export uses full res)
    const PREVIEW_MAX = 1200;
    let drawScale = 1;
    let drawWidth = width;
    let drawHeight = height;
    if (width > PREVIEW_MAX || height > PREVIEW_MAX) {
        drawScale = PREVIEW_MAX / Math.max(width, height);
        drawWidth = Math.max(1, Math.floor(width * drawScale));
        drawHeight = Math.max(1, Math.floor(height * drawScale));
    }
    
    canvas.width = drawWidth;
    canvas.height = drawHeight;
    
    // Generate pixel positions based on arrangement pattern
    pixelPositions = generatePixelPositions(tokens, canvasInfo, arrangementPattern);
    
    // Filter positions based on canvas shape
    pixelPositions = pixelPositions.map(pos => ({
        ...pos,
        valid: isValidPosition(pos, canvasInfo, canvasShape)
    }));
    
    // Draw via ImageData (single buffer + putImageData) for large token counts
    const imageData = ctx.createImageData(drawWidth, drawHeight);
    const data = imageData.data;
    const drawSize = Math.max(1, Math.floor(pixelSize * drawScale));
    
    for (let i = 0; i < pixelPositions.length; i++) {
        const pos = pixelPositions[i];
        if (!pos.valid) continue;
        const hex = displayColorMap.get(pos.token) || tokenColorMap.get(pos.token);
        const rgb = hexToRgb(hex);
        if (!rgb) continue;
        const r = rgb.r, g = rgb.g, b = rgb.b;
        const baseX = Math.min(drawWidth - 1, Math.floor(pos.x * drawScale));
        const baseY = Math.min(drawHeight - 1, Math.floor(pos.y * drawScale));
        const endX = Math.min(drawWidth, baseX + drawSize);
        const endY = Math.min(drawHeight, baseY + drawSize);
        for (let py = baseY; py < endY; py++) {
            for (let px = baseX; px < endX; px++) {
                const idx = (py * drawWidth + px) * 4;
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255;
            }
        }
    }
    ctx.putImageData(imageData, 0, 0);
    
    // Detect and draw trend highlights (O(1) lookup via positionToDrawMap)
    if (highlightTrends) {
        const positionColorMap = buildPositionColorMap(displayColorMap);
        const allTrends = [];
        if (trendHorizontal) allTrends.push(...detectTrends(displayColorMap, cols, rows, 'horizontal', positionColorMap));
        if (trendVertical) allTrends.push(...detectTrends(displayColorMap, cols, rows, 'vertical', positionColorMap));
        if (trendDiagonal) allTrends.push(...detectTrends(displayColorMap, cols, rows, 'diagonal', positionColorMap));
        const positionToDrawMap = buildRowColToDrawMap(pixelPositions, pixelSize, drawScale);
        allTrends.forEach(trend => drawTrendHighlights([trend], positionToDrawMap));
    }
}

// Export video of animated plotting in 3D COLOR SPACE view (RGB cube)
function exportVideo3DView() {
    if (!viewRGB3D || !sceneRGB3D || !rendererRGB3D) {
        alert('Please enable RGB 3D View (Color Space) first, then click Start Video Export.');
        return;
    }
    
    if (!HTMLCanvasElement.prototype.captureStream) {
        alert('Video recording is not supported in this browser. Please use Chrome, Firefox, or Edge.');
        return;
    }
    
    tokens = tokenize(textInput.value);
    if (tokens.length === 0) {
        alert('No tokens to export. Please enter some text first.');
        return;
    }
    
    tokens.forEach(token => getColorForToken(token, currentMode));
    const displayColorMap = emphasizeSimilarColors(tokenColorMap, similarityThreshold);
    
    // Build points in RGB color space (r,g,b) = (x,y,z)
    const pointSize = 5;
    const positions = [];
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const hexColor = displayColorMap.get(token) || tokenColorMap.get(token);
        const rgb = hexToRgb(hexColor);
        if (!rgb) continue;
        positions.push({ x: rgb.r, y: rgb.g, z: rgb.b, color: hexColor });
    }
    if (positions.length === 0) {
        alert('No valid color positions to plot.');
        return;
    }

    const targetSize = getVideoExportSize();
    const prevWidth = rendererRGB3D.domElement.width;
    const prevHeight = rendererRGB3D.domElement.height;
    const prevPixelRatio = rendererRGB3D.getPixelRatio();
    rendererRGB3D.setSize(targetSize.width, targetSize.height);
    rendererRGB3D.setPixelRatio(1);
    cameraRGB3D.aspect = targetSize.width / targetSize.height;
    cameraRGB3D.updateProjectionMatrix();
    
    // Remove existing token points and path from RGB scene (keep lights, axes, wireframe)
    const toRemove = [];
    sceneRGB3D.children.forEach(child => {
        if ((child instanceof THREE.Mesh || child instanceof THREE.InstancedMesh) && child.userData.isTokenPoint) toRemove.push(child);
        if (child instanceof THREE.Line && child.userData.isPathLine) toRemove.push(child);
    });
    toRemove.forEach(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material && child.material.dispose) child.material.dispose();
        sceneRGB3D.remove(child);
    });
    
    const count = positions.length;
    const geometry = rgb3DShape === 'sphere'
        ? new THREE.SphereGeometry(pointSize, 12, 12)
        : new THREE.BoxGeometry(pointSize * 2, pointSize * 2, pointSize * 2);
    const material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        color: 0xffffff
    });
    const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
    instancedMesh.userData.isTokenPoint = true;
    instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    const offScreen = -10000;
    
    for (let i = 0; i < count; i++) {
        const p = positions[i];
        color.set(p.color);
        instancedMesh.setColorAt(i, color);
        matrix.identity();
        matrix.setPosition(offScreen, offScreen, offScreen);
        instancedMesh.setMatrixAt(i, matrix);
    }
    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.instanceColor.needsUpdate = true;
    sceneRGB3D.add(instancedMesh);
    
    let stream;
    try {
        stream = rendererRGB3D.domElement.captureStream(30);
    } catch (e) {
        rendererRGB3D.setSize(prevWidth, prevHeight);
        rendererRGB3D.setPixelRatio(prevPixelRatio);
        cameraRGB3D.aspect = prevWidth / prevHeight;
        cameraRGB3D.updateProjectionMatrix();
        alert('Failed to capture stream. Error: ' + e.message);
        return;
    }
    
    recordedChunks = [];
    let mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8';
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
    
    try {
        mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });
    } catch (e) {
        alert('Failed to create MediaRecorder. Error: ' + e.message);
        return;
    }
    
    mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) recordedChunks.push(event.data);
    };
    
    mediaRecorder.onstop = () => {
        rendererRGB3D.setSize(prevWidth, prevHeight);
        rendererRGB3D.setPixelRatio(prevPixelRatio);
        cameraRGB3D.aspect = prevWidth / prevHeight;
        cameraRGB3D.updateProjectionMatrix();
        // Restore RGB 3D scene to normal view
        const toRemove = [];
        sceneRGB3D.children.forEach(child => {
            if ((child instanceof THREE.Mesh || child instanceof THREE.InstancedMesh) && child.userData.isTokenPoint) toRemove.push(child);
            if (child instanceof THREE.Line && child.userData.isPathLine) toRemove.push(child);
        });
        toRemove.forEach(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material && child.material.dispose) child.material.dispose();
            sceneRGB3D.remove(child);
        });
        renderCanvasRGB3D();
        if (recordedChunks.length === 0) {
            alert('No video data recorded.');
            isRecordingVideo = false;
            startVideoExportBtn.textContent = 'Start Video Export';
            startVideoExportBtn.disabled = false;
            return;
        }
        const blob = new Blob(recordedChunks, { type: mimeType });
        const filename = generateRandomFilename('video.webm');
        if (typeof window !== 'undefined' && window.desktopAPI) {
            const reader = new FileReader();
            reader.onloadend = () => {
                window.desktopAPI.saveFile(filename, [{ name: 'WebM Video', extensions: ['webm'] }]).then((result) => {
                    if (result.canceled) { isRecordingVideo = false; startVideoExportBtn.textContent = 'Start Video Export'; startVideoExportBtn.disabled = false; return; }
                    window.desktopAPI.writeFileBuffer(result.path, new Uint8Array(reader.result)).then(() => showMessage('Video saved to ' + result.path)).catch((err) => showMessage('Save failed: ' + err.message));
                    isRecordingVideo = false;
                    startVideoExportBtn.textContent = 'Start Video Export';
                    startVideoExportBtn.disabled = false;
                });
            };
            reader.readAsArrayBuffer(blob);
            return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        isRecordingVideo = false;
        startVideoExportBtn.textContent = 'Start Video Export';
        startVideoExportBtn.disabled = false;
    };
    
    mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        alert('An error occurred during recording: ' + event.error);
        isRecordingVideo = false;
        startVideoExportBtn.textContent = 'Start Video Export';
        startVideoExportBtn.disabled = false;
    };
    
    try { mediaRecorder.start(); } catch (e) {
        alert('Failed to start recording. Error: ' + e.message);
        return;
    }
    
    isRecordingVideo = true;
    startVideoExportBtn.textContent = 'Recording...';
    startVideoExportBtn.disabled = true;
    
    let currentIndex = 0;
    let pathLine = null;
    const fps = 30;
    const frameDelay = 1000 / fps;
    let lastFrameTime = performance.now();
    
    function animatePlotting() {
        if (!isRecordingVideo) {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            return;
        }
        const now = performance.now();
        const elapsed = now - lastFrameTime;
        
        if (elapsed >= frameDelay) {
            if (currentIndex >= count) {
                setTimeout(() => {
                    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
                    if (animationFrameId) cancelAnimationFrame(animationFrameId);
                }, 1000);
                rendererRGB3D.render(sceneRGB3D, cameraRGB3D);
                animationFrameId = requestAnimationFrame(animatePlotting);
                return;
            }
            const pointsToAdd = Math.max(1, Math.ceil(plotSpeed3D));
            for (let k = 0; k < pointsToAdd && currentIndex < count; k++) {
                const p = positions[currentIndex];
                matrix.identity();
                matrix.setPosition(p.x, p.y, p.z);
                instancedMesh.setMatrixAt(currentIndex, matrix);
                currentIndex++;
            }
            instancedMesh.instanceMatrix.needsUpdate = true;
            
            if (rgb3DShowPath && currentIndex > 1) {
                if (pathLine) { sceneRGB3D.remove(pathLine); if (pathLine.geometry) pathLine.geometry.dispose(); if (pathLine.material && pathLine.material.dispose) pathLine.material.dispose(); }
                const pathGeometry = new THREE.BufferGeometry();
                const pathPositions = new Float32Array(currentIndex * 3);
                for (let i = 0; i < currentIndex; i++) {
                    pathPositions[i * 3] = positions[i].x;
                    pathPositions[i * 3 + 1] = positions[i].y;
                    pathPositions[i * 3 + 2] = positions[i].z;
                }
                pathGeometry.setAttribute('position', new THREE.BufferAttribute(pathPositions, 3));
                pathLine = new THREE.Line(pathGeometry, new THREE.LineBasicMaterial({ color: 0x888888, opacity: 0.5, transparent: true }));
                pathLine.userData.isPathLine = true;
                sceneRGB3D.add(pathLine);
            }
            lastFrameTime = now;
        }
        rendererRGB3D.render(sceneRGB3D, cameraRGB3D);
        animationFrameId = requestAnimationFrame(animatePlotting);
    }
    
    lastFrameTime = performance.now();
    animatePlotting();
}

// Re-randomize colors
function randomizeColors() {
    tokenColorMap.clear();
    renderCanvas();
}

// Export high-res image
function exportHighResImage() {
    if (tokens.length === 0) {
        alert('No tokens to export. Please enter some text first.');
        return;
    }
    
    // Apply color similarity emphasis if enabled
    const displayColorMap = emphasizeSimilarColors(tokenColorMap, similarityThreshold);
    
    // Calculate canvas dimensions based on shape
    const canvasInfo = calculateCanvasSize(tokens, pixelSize, canvasShape);
    const { width, height, cols, rows } = canvasInfo;
    
    // Generate pixel positions based on arrangement pattern
    const exportPixelPositions = generatePixelPositions(tokens, canvasInfo, arrangementPattern);
    const filteredPositions = exportPixelPositions.map(pos => ({
        ...pos,
        valid: isValidPosition(pos, canvasInfo, canvasShape)
    }));
    
    // Create a high-resolution canvas (configurable scale, up to very high)
    const scale = getExportScale();
    const maxDim = 32768;
    let outW = width * scale;
    let outH = height * scale;
    if (outW > maxDim || outH > maxDim) {
        const r = Math.min(maxDim / outW, maxDim / outH);
        outW = Math.floor(outW * r);
        outH = Math.floor(outH * r);
        if (scale > 1) alert('Image scaled down to fit max dimension ' + maxDim + 'px. Output: ' + outW + '×' + outH);
    }
    const highResCanvas = document.createElement('canvas');
    const highResCtx = highResCanvas.getContext('2d');
    highResCanvas.width = outW;
    highResCanvas.height = outH;
    const drawScale = outW / width;
    const exportPixelSize = Math.max(1, Math.floor(pixelSize * drawScale));
    
    // Draw via ImageData for large token counts (fast export)
    const imageData = highResCtx.createImageData(outW, outH);
    const data = imageData.data;
    const rowColToExport = new Map(); // row,col -> {x, y} in export coords (for trends)
    
    for (let i = 0; i < filteredPositions.length; i++) {
        const pos = filteredPositions[i];
        if (!pos.valid) continue;
        const hex = displayColorMap.get(pos.token) || tokenColorMap.get(pos.token);
        const rgb = hexToRgb(hex);
        if (!rgb) continue;
        const baseX = Math.floor(pos.x * drawScale);
        const baseY = Math.floor(pos.y * drawScale);
        const endX = Math.min(outW, baseX + exportPixelSize);
        const endY = Math.min(outH, baseY + exportPixelSize);
        rowColToExport.set(pos.row + ',' + pos.col, { x: baseX, y: baseY, size: exportPixelSize });
        for (let py = baseY; py < endY; py++) {
            for (let px = baseX; px < endX; px++) {
                const idx = (py * outW + px) * 4;
                data[idx] = rgb.r;
                data[idx + 1] = rgb.g;
                data[idx + 2] = rgb.b;
                data[idx + 3] = 255;
            }
        }
    }
    highResCtx.putImageData(imageData, 0, 0);
    
    // Draw trend highlights (O(1) lookup via rowColToExport)
    if (highlightTrends) {
        const positionColorMap = new Map();
        for (let i = 0; i < filteredPositions.length; i++) {
            const p = filteredPositions[i];
            if (p.valid) positionColorMap.set(p.row + ',' + p.col, displayColorMap.get(p.token) || tokenColorMap.get(p.token));
        }
        const allTrends = [];
        if (trendHorizontal) allTrends.push(...detectTrends(displayColorMap, cols, rows, 'horizontal', positionColorMap));
        if (trendVertical) allTrends.push(...detectTrends(displayColorMap, cols, rows, 'vertical', positionColorMap));
        if (trendDiagonal) allTrends.push(...detectTrends(displayColorMap, cols, rows, 'diagonal', positionColorMap));
        
        const rgb = hexToRgbForHighlight(highlightColorHex);
        const highlightColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${trendOpacity / 100})`;
        const borderColor = `rgba(${Math.max(0, rgb.r - 55)}, ${Math.max(0, rgb.g - 55)}, ${Math.max(0, rgb.b - 55)}, ${Math.min(trendOpacity / 100 + 0.2, 1)})`;
        highResCtx.lineWidth = Math.max(1, Math.floor(drawScale));
        allTrends.forEach(trend => {
            trend.forEach(({ row, col }) => {
                const d = rowColToExport.get(row + ',' + col);
                if (!d) return;
                highResCtx.fillStyle = highlightColor;
                highResCtx.fillRect(d.x, d.y, d.size, d.size);
                highResCtx.strokeStyle = borderColor;
                highResCtx.strokeRect(d.x, d.y, d.size, d.size);
            });
        });
    }
    
    const filename = generateRandomFilename('image.png');

    // Desktop: use save dialog and write file
    if (typeof window !== 'undefined' && window.desktopAPI) {
        highResCanvas.toBlob((blob) => {
            window.desktopAPI.saveImage(filename).then((result) => {
                if (result.canceled) return;
                const reader = new FileReader();
                reader.onloadend = () => {
                    const buf = new Uint8Array(reader.result);
                    window.desktopAPI.writeFileBuffer(result.path, buf).then(() => {
                        showMessage('Image saved to ' + result.path);
                    }).catch((err) => showMessage('Save failed: ' + err.message));
                };
                reader.readAsArrayBuffer(blob);
            });
        });
        return;
    }

    // Web: download via link
    highResCanvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}

function showMessage(msg) {
    alert(msg);
}

// Generate random filename based on 3 random tokens + date
function generateRandomFilename(extension) {
    if (tokens.length === 0) {
        const date = new Date();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        return `token_${month}${day}${year}_${extension}`;
    }
    
    // Get 3 random unique tokens
    const shuffled = [...tokens].sort(() => 0.5 - Math.random());
    const selectedTokens = shuffled.slice(0, Math.min(3, tokens.length));
    const tokenNames = selectedTokens.map(t => t.replace(/[^a-zA-Z0-9]/g, '_')).join('');
    
    // Get date in MMDDYYYY format
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${tokenNames}_${month}${day}${year}_${extension}`;
}

// Download color mapping as JSON
function downloadColorMapping() {
    if (tokenColorMap.size === 0) {
        alert('No color mapping to download. Please enter some text first.');
        return;
    }
    const mapping = {};
    tokenColorMap.forEach((color, token) => {
        mapping[token] = color;
    });
    const json = JSON.stringify(mapping, null, 2);
    const filename = generateRandomFilename('map.json');

    if (typeof window !== 'undefined' && window.desktopAPI) {
        window.desktopAPI.saveFile(filename, [{ name: 'JSON', extensions: ['json'] }]).then((result) => {
            if (result.canceled) return;
            window.desktopAPI.writeFile(result.path, json).then(() => {
                showMessage('Color mapping saved to ' + result.path);
            }).catch((err) => showMessage('Save failed: ' + err.message));
        });
        return;
    }

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --- Desktop: file open/save and menu handlers ---
async function openFile() {
    if (typeof window === 'undefined' || !window.desktopAPI) return;
    const result = await window.desktopAPI.openFile([{ name: 'Text Files', extensions: ['txt', 'md', 'json'] }, { name: 'All Files', extensions: ['*'] }]);
    if (result.canceled || !result.path) return;
    try {
        const content = await window.desktopAPI.readFile(result.path);
        textInput.value = content;
        renderCanvas();
    } catch (err) {
        alert('Could not read file: ' + err.message);
    }
}

async function saveTextToFile() {
    if (typeof window === 'undefined' || !window.desktopAPI) return;
    const result = await window.desktopAPI.saveFile('document.txt', [{ name: 'Text Files', extensions: ['txt'] }, { name: 'All Files', extensions: ['*'] }]);
    if (result.canceled || !result.path) return;
    try {
        await window.desktopAPI.writeFile(result.path, textInput.value);
        showMessage('Text saved to ' + result.path);
    } catch (err) {
        alert('Could not save file: ' + err.message);
    }
}

async function importColorMapping() {
    if (typeof window === 'undefined' || !window.desktopAPI) return;
    const result = await window.desktopAPI.openFile([{ name: 'JSON', extensions: ['json'] }, { name: 'All Files', extensions: ['*'] }]);
    if (result.canceled || !result.path) return;
    try {
        const content = await window.desktopAPI.readFile(result.path);
        const mapping = JSON.parse(content);
        tokenColorMap.clear();
        Object.entries(mapping).forEach(([token, color]) => tokenColorMap.set(token, color));
        renderCanvas();
        showMessage('Color mapping imported. Tokens in current text will use these colors.');
    } catch (err) {
        alert('Could not import mapping: ' + err.message);
    }
}

function setupDesktopMenus() {
    if (typeof window === 'undefined' || !window.desktopAPI) return;
    window.desktopAPI.onMenuOpenFile(() => openFile());
    window.desktopAPI.onMenuSaveText(() => saveTextToFile());
    window.desktopAPI.onMenuImportMapping(() => importColorMapping());
    window.desktopAPI.onMenuExportMapping(() => downloadColorMapping());
    window.desktopAPI.onMenuExportImage(() => exportHighResImage());
    window.desktopAPI.onMenuAbout(() => {
        (window.desktopAPI.getVersion ? window.desktopAPI.getVersion() : Promise.resolve('1.0.0'))
            .then(ver => alert('Token Color Mapper Desktop\nVersion ' + ver));
    });
}

// Debounce helper (for large text: avoid re-render on every keystroke)
let renderDebounceTimer = null;
function scheduleRender() {
    if (renderDebounceTimer) clearTimeout(renderDebounceTimer);
    renderDebounceTimer = setTimeout(() => {
        renderDebounceTimer = null;
        renderCanvas();
    }, 250);
}

// Event listeners
textInput.addEventListener('input', () => {
    scheduleRender();
});

if (tokenizeModeSelect) {
    tokenizeModeSelect.addEventListener('change', (e) => {
        tokenizeMode = e.target.value;
        customSepGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
        renderCanvas();
    });
}
if (customSeparatorInput) {
    customSeparatorInput.addEventListener('input', () => { renderCanvas(); });
    customSeparatorInput.addEventListener('change', () => { renderCanvas(); });
}
if (exportScaleSelect) {
    exportScaleSelect.addEventListener('change', (e) => {
        if (exportScaleCustomGroup) exportScaleCustomGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
    });
}
if (videoExportResSelect) {
    videoExportResSelect.addEventListener('change', (e) => {
        if (videoExportCustomGroup) videoExportCustomGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
    });
}
if (openFileBtn) openFileBtn.addEventListener('click', openFile);
if (saveTextBtn) saveTextBtn.addEventListener('click', saveTextToFile);

// Desktop menu wiring
if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupDesktopMenus);
} else {
    setupDesktopMenus();
}

modeSelect.addEventListener('change', (e) => {
    currentMode = e.target.value;
    // Clear mapping when switching modes to regenerate colors
    tokenColorMap.clear();
    renderCanvas();
});

pixelSizeSlider.addEventListener('input', (e) => {
    pixelSize = parseInt(e.target.value);
    pixelSizeValue.textContent = pixelSize;
    renderCanvas();
});

canvasShapeSelect.addEventListener('change', (e) => {
    canvasShape = e.target.value;
    renderCanvas();
});

arrangementPatternSelect.addEventListener('change', (e) => {
    arrangementPattern = e.target.value;
    renderCanvas();
});

emphasizeSimilarityCheckbox.addEventListener('change', (e) => {
    emphasizeSimilarity = e.target.checked;
    similarityThresholdGroup.style.display = emphasizeSimilarity ? 'block' : 'none';
    renderCanvas();
});

similarityThresholdSlider.addEventListener('input', (e) => {
    similarityThreshold = parseInt(e.target.value);
    similarityThresholdValue.textContent = similarityThreshold;
    renderCanvas();
});

highlightTrendsCheckbox.addEventListener('change', (e) => {
    highlightTrends = e.target.checked;
    trendControlsGroup.style.display = highlightTrends ? 'block' : 'none';
    renderCanvas();
});

trendHorizontalCheckbox.addEventListener('change', (e) => {
    trendHorizontal = e.target.checked;
    renderCanvas();
});

trendVerticalCheckbox.addEventListener('change', (e) => {
    trendVertical = e.target.checked;
    renderCanvas();
});

trendDiagonalCheckbox.addEventListener('change', (e) => {
    trendDiagonal = e.target.checked;
    renderCanvas();
});

trendMinLengthSlider.addEventListener('input', (e) => {
    trendMinLength = parseInt(e.target.value);
    trendMinLengthValue.textContent = trendMinLength;
    renderCanvas();
});

trendSimilaritySlider.addEventListener('input', (e) => {
    trendSimilarity = parseInt(e.target.value);
    trendSimilarityValue.textContent = trendSimilarity;
    renderCanvas();
});

trendOpacitySlider.addEventListener('input', (e) => {
    trendOpacity = parseInt(e.target.value);
    trendOpacityValue.textContent = trendOpacity;
    renderCanvas();
});

highlightColorInput.addEventListener('input', (e) => {
    highlightColorHex = e.target.value;
    renderCanvas();
});

view3DCheckbox.addEventListener('change', (e) => {
    view3D = e.target.checked;
    if (view3D) {
        viewRGB3D = false;
        viewRGB3DCheckbox.checked = false;
        rgb3DControlsGroup.style.display = 'none';
        view3DControlsGroup.style.display = 'block';
        canvas.style.display = 'none';
        canvasRGB3DContainer.style.display = 'none';
        canvas3DContainer.style.display = 'block';
        if (!window.THREE) {
            alert('Three.js library failed to load. Please refresh the page.');
            view3D = false;
            view3DCheckbox.checked = false;
            return;
        }
        init3DView();
        renderCanvas3D();
    } else {
        view3DControlsGroup.style.display = 'none';
        if (!viewRGB3D) {
            canvas.style.display = 'block';
        }
        canvas3DContainer.style.display = 'none';
        if (controls3D && controls3D.dispose) {
            controls3D.dispose();
        }
        if (renderer3D) {
            renderer3D.dispose();
        }
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
    }
});

pointSize3DSlider.addEventListener('input', (e) => {
    pointSize3D = parseFloat(e.target.value);
    pointSize3DValue.textContent = pointSize3D.toFixed(2);
    renderCanvas();
});

showLines3DCheckbox.addEventListener('change', (e) => {
    showLines3D = e.target.checked;
    renderCanvas();
});

plotSpeed3DSlider.addEventListener('input', (e) => {
    plotSpeed3D = parseFloat(e.target.value);
    plotSpeed3DValue.textContent = plotSpeed3D.toFixed(1);
});

startVideoExportBtn.addEventListener('click', () => {
    if (!isRecordingVideo) {
        exportVideo3DView();
    }
});

viewRGB3DCheckbox.addEventListener('change', (e) => {
    viewRGB3D = e.target.checked;
    if (viewRGB3D) {
        view3D = false;
        view3DCheckbox.checked = false;
        canvas.style.display = 'none';
        canvas3DContainer.style.display = 'none';
        canvasRGB3DContainer.style.display = 'block';
        rgb3DControlsGroup.style.display = 'block';
        if (!window.THREE) {
            alert('Three.js library failed to load. Please refresh the page.');
            viewRGB3D = false;
            viewRGB3DCheckbox.checked = false;
            return;
        }
        initRGB3DView();
        renderCanvasRGB3D();
    } else {
        rgb3DControlsGroup.style.display = 'none';
        if (!view3D) {
            canvas.style.display = 'block';
        }
        canvasRGB3DContainer.style.display = 'none';
        if (animationIdRGB3D) {
            cancelAnimationFrame(animationIdRGB3D);
            animationIdRGB3D = null;
        }
        if (controlsRGB3D && controlsRGB3D.dispose) {
            controlsRGB3D.dispose();
        }
        if (rendererRGB3D) {
            rendererRGB3D.dispose();
        }
    }
});

rgb3DShapeSelect.addEventListener('change', (e) => {
    rgb3DShape = e.target.value;
    renderCanvas();
});

rgb3DShowPathCheckbox.addEventListener('change', (e) => {
    rgb3DShowPath = e.target.checked;
    renderCanvas();
});

randomizeBtn.addEventListener('click', () => {
    if (currentMode === 'random') {
        randomizeColors();
    } else {
        alert('Re-randomization only works in Random mode. Switch to Random mode first.');
    }
});

exportImageBtn.addEventListener('click', exportHighResImage);
downloadJsonBtn.addEventListener('click', downloadColorMapping);

// Handle window resize for 3D views
window.addEventListener('resize', () => {
    if (view3D && renderer3D && camera3D) {
        const container = canvas3DContainer;
        const width = container.clientWidth;
        const height = container.clientHeight || 600;
        
        camera3D.aspect = width / height;
        camera3D.updateProjectionMatrix();
        renderer3D.setSize(width, height);
    }
    if (viewRGB3D && rendererRGB3D && cameraRGB3D) {
        const container = canvasRGB3DContainer;
        const width = container.clientWidth;
        const height = container.clientHeight || 600;
        
        cameraRGB3D.aspect = width / height;
        cameraRGB3D.updateProjectionMatrix();
        rendererRGB3D.setSize(width, height);
    }
});

// Persist settings to localStorage (desktop app)
function saveSettings() {
    try {
        const s = {
            pixelSize,
            currentMode,
            canvasShape,
            arrangementPattern,
            emphasizeSimilarity,
            similarityThreshold,
            highlightTrends,
            trendHorizontal,
            trendVertical,
            trendDiagonal,
            trendMinLength,
            trendSimilarity,
            trendOpacity,
            highlightColorHex,
            tokenizeMode: tokenizeModeSelect ? tokenizeModeSelect.value : 'words',
            customSeparator: customSeparatorInput ? customSeparatorInput.value : ',',
            exportScale: exportScaleSelect ? exportScaleSelect.value : '4',
            exportScaleCustom: exportScaleCustomInput ? exportScaleCustomInput.value : '64',
            videoExportRes: videoExportResSelect ? videoExportResSelect.value : '1920x1080',
            videoExportWidth: videoExportWidthInput ? videoExportWidthInput.value : '1920',
            videoExportHeight: videoExportHeightInput ? videoExportHeightInput.value : '1080',
        };
        localStorage.setItem('tokenColorMapperSettings', JSON.stringify(s));
    } catch (_) {}
}

function loadSettings() {
    try {
        const raw = localStorage.getItem('tokenColorMapperSettings');
        if (!raw) return;
        const s = JSON.parse(raw);
        if (s.pixelSize != null) { pixelSize = s.pixelSize; if (pixelSizeSlider) pixelSizeSlider.value = pixelSize; if (pixelSizeValue) pixelSizeValue.textContent = pixelSize; }
        if (s.currentMode) { currentMode = s.currentMode; if (modeSelect) modeSelect.value = currentMode; }
        if (s.canvasShape) { canvasShape = s.canvasShape; if (canvasShapeSelect) canvasShapeSelect.value = canvasShape; }
        if (s.arrangementPattern) { arrangementPattern = s.arrangementPattern; if (arrangementPatternSelect) arrangementPatternSelect.value = arrangementPattern; }
        if (s.emphasizeSimilarity != null) { emphasizeSimilarity = s.emphasizeSimilarity; if (emphasizeSimilarityCheckbox) emphasizeSimilarityCheckbox.checked = emphasizeSimilarity; similarityThresholdGroup.style.display = emphasizeSimilarity ? 'block' : 'none'; }
        if (s.similarityThreshold != null) { similarityThreshold = s.similarityThreshold; if (similarityThresholdSlider) similarityThresholdSlider.value = similarityThreshold; if (similarityThresholdValue) similarityThresholdValue.textContent = similarityThreshold; }
        if (s.highlightTrends != null) { highlightTrends = s.highlightTrends; if (highlightTrendsCheckbox) highlightTrendsCheckbox.checked = highlightTrends; trendControlsGroup.style.display = highlightTrends ? 'block' : 'none'; }
        if (s.trendHorizontal != null && trendHorizontalCheckbox) trendHorizontalCheckbox.checked = s.trendHorizontal;
        if (s.trendVertical != null && trendVerticalCheckbox) trendVerticalCheckbox.checked = s.trendVertical;
        if (s.trendDiagonal != null && trendDiagonalCheckbox) trendDiagonalCheckbox.checked = s.trendDiagonal;
        if (s.trendMinLength != null) { trendMinLength = s.trendMinLength; if (trendMinLengthSlider) trendMinLengthSlider.value = trendMinLength; if (trendMinLengthValue) trendMinLengthValue.textContent = trendMinLength; }
        if (s.trendSimilarity != null) { trendSimilarity = s.trendSimilarity; if (trendSimilaritySlider) trendSimilaritySlider.value = trendSimilarity; if (trendSimilarityValue) trendSimilarityValue.textContent = trendSimilarity; }
        if (s.trendOpacity != null) { trendOpacity = s.trendOpacity; if (trendOpacitySlider) trendOpacitySlider.value = trendOpacity; if (trendOpacityValue) trendOpacityValue.textContent = trendOpacity; }
        if (s.highlightColorHex && highlightColorInput) highlightColorInput.value = s.highlightColorHex;
        if (s.tokenizeMode && tokenizeModeSelect) { tokenizeModeSelect.value = s.tokenizeMode; customSepGroup.style.display = s.tokenizeMode === 'custom' ? 'block' : 'none'; }
        if (s.customSeparator && customSeparatorInput) customSeparatorInput.value = s.customSeparator;
        if (s.exportScale && exportScaleSelect) {
            exportScaleSelect.value = s.exportScale;
            if (exportScaleCustomGroup) exportScaleCustomGroup.style.display = s.exportScale === 'custom' ? 'block' : 'none';
        }
        if (s.exportScaleCustom && exportScaleCustomInput) exportScaleCustomInput.value = s.exportScaleCustom;
        if (s.videoExportRes && videoExportResSelect) {
            videoExportResSelect.value = s.videoExportRes;
            if (videoExportCustomGroup) videoExportCustomGroup.style.display = s.videoExportRes === 'custom' ? 'block' : 'none';
        }
        if (s.videoExportWidth && videoExportWidthInput) videoExportWidthInput.value = s.videoExportWidth;
        if (s.videoExportHeight && videoExportHeightInput) videoExportHeightInput.value = s.videoExportHeight;
        if (trendHorizontalCheckbox) trendHorizontal = trendHorizontalCheckbox.checked;
        if (trendVerticalCheckbox) trendVertical = trendVerticalCheckbox.checked;
        if (trendDiagonalCheckbox) trendDiagonal = trendDiagonalCheckbox.checked;
        if (highlightColorInput) highlightColorHex = highlightColorInput.value;
    } catch (_) {}
}

// Save settings when controls change
function attachSettingsSave() {
    const save = () => { saveSettings(); };
    [modeSelect, pixelSizeSlider, canvasShapeSelect, arrangementPatternSelect, emphasizeSimilarityCheckbox,
     similarityThresholdSlider, highlightTrendsCheckbox, trendHorizontalCheckbox, trendVerticalCheckbox, trendDiagonalCheckbox,
     trendMinLengthSlider, trendSimilaritySlider, trendOpacitySlider, highlightColorInput, tokenizeModeSelect, customSeparatorInput,
     exportScaleSelect, exportScaleCustomInput, videoExportResSelect, videoExportWidthInput, videoExportHeightInput]
        .filter(Boolean).forEach(el => { el.addEventListener('change', save); el.addEventListener('input', save); });
}

loadSettings();
attachSettingsSave();

// Initial render
renderCanvas();