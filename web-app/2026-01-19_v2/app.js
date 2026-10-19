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
let pixelPositions = []; // Array of {row, col, x, y} for each token
let view3D = false;
let scene3D, camera3D, renderer3D, controls3D;

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
const canvas3DContainer = document.getElementById('canvas3D');

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

// Cluster similar colors together
function emphasizeSimilarColors(colorMap, threshold) {
    if (!emphasizeSimilarity || threshold === 0) {
        return new Map(colorMap);
    }
    
    const adjustedMap = new Map();
    const maxDistance = getMaxColorDistance();
    const thresholdDistance = (threshold / 100) * maxDistance;
    
    // Create clusters of similar colors
    const clusters = [];
    const processed = new Set();
    
    colorMap.forEach((color, token) => {
        if (processed.has(token)) return;
        
        const cluster = [{ token, color }];
        processed.add(token);
        
        // Find all similar colors
        colorMap.forEach((otherColor, otherToken) => {
            if (processed.has(otherToken)) return;
            
            const distance = colorDistance(color, otherColor);
            if (distance <= thresholdDistance) {
                cluster.push({ token: otherToken, color: otherColor });
                processed.add(otherToken);
            }
        });
        
        clusters.push(cluster);
    });
    
    // Calculate average color for each cluster
    clusters.forEach(cluster => {
        if (cluster.length === 1) {
            adjustedMap.set(cluster[0].token, cluster[0].color);
            return;
        }
        
        // Calculate average RGB
        let totalR = 0, totalG = 0, totalB = 0;
        cluster.forEach(({ color }) => {
            const rgb = hexToRgb(color);
            if (rgb) {
                totalR += rgb.r;
                totalG += rgb.g;
                totalB += rgb.b;
            }
        });
        
        const avgR = totalR / cluster.length;
        const avgG = totalG / cluster.length;
        const avgB = totalB / cluster.length;
        
        const avgColor = rgbToHex(avgR, avgG, avgB);
        
        // Assign average color to all tokens in cluster
        cluster.forEach(({ token }) => {
            adjustedMap.set(token, avgColor);
        });
    });
    
    return adjustedMap;
}

// Tokenize text input
function tokenize(text) {
    if (!text || text.trim() === '') {
        return [];
    }
    // Split by whitespace and filter out empty strings
    return text.trim().split(/\s+/).filter(token => token.length > 0);
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
        // Random positions
        const used = new Set();
        tokens.forEach((token) => {
            let row, col, key;
            do {
                row = Math.floor(Math.random() * rows);
                col = Math.floor(Math.random() * cols);
                key = `${row},${col}`;
            } while (used.has(key));
            used.add(key);
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

// Get color at grid position
function getColorAtPosition(displayColorMap, row, col) {
    // Find position in pixelPositions array
    const pos = pixelPositions.find(p => p.row === row && p.col === col && p.valid);
    if (pos) {
        return displayColorMap.get(pos.token) || tokenColorMap.get(pos.token);
    }
    return null;
}

// Detect trends in a specific direction
function detectTrends(displayColorMap, cols, rows, direction) {
    const trends = [];
    const maxDistance = getMaxColorDistance();
    const thresholdDistance = (trendSimilarity / 100) * maxDistance;
    
    if (direction === 'horizontal') {
        // Check horizontal trends (left to right)
        for (let row = 0; row < rows; row++) {
            let currentTrend = [];
            let lastColor = null;
            
            for (let col = 0; col < cols; col++) {
                const color = getColorAtPosition(displayColorMap, row, col);
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
                const color = getColorAtPosition(displayColorMap, row, col);
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
                const color = getColorAtPosition(displayColorMap, row, col);
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
                const color = getColorAtPosition(displayColorMap, row, col);
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
                const color = getColorAtPosition(displayColorMap, row, col);
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
                const color = getColorAtPosition(displayColorMap, row, col);
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

// Draw trend highlights on canvas
function drawTrendHighlights(trends) {
    if (!highlightTrends || trends.length === 0) return;
    
    const rgb = hexToRgbForHighlight(highlightColorHex);
    const highlightColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${trendOpacity / 100})`;
    const borderColor = `rgba(${Math.max(0, rgb.r - 55)}, ${Math.max(0, rgb.g - 55)}, ${Math.max(0, rgb.b - 55)}, ${Math.min(trendOpacity / 100 + 0.2, 1)})`;
    
    trends.forEach(trend => {
        trend.forEach(({ row, col }) => {
            // Find the position in pixelPositions array
            const pos = pixelPositions.find(p => p.row === row && p.col === col && p.valid);
            if (!pos) return;
            
            // Draw highlight overlay
            ctx.fillStyle = highlightColor;
            ctx.fillRect(pos.x, pos.y, pixelSize, pixelSize);
            
            // Draw border for better visibility
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(pos.x, pos.y, pixelSize, pixelSize);
        });
    });
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
    
    // Clear existing geometry
    while(scene3D.children.length > 2) { // Keep lights
        scene3D.remove(scene3D.children[scene3D.children.length - 1]);
    }
    
    // Create 3D cubes for each pixel
    const cubeSize = 0.1;
    const spacing = 0.12;
    
    pixelPositions.forEach((pos) => {
        if (!pos.valid) return;
        
        const color = displayColorMap.get(pos.token) || tokenColorMap.get(pos.token);
        const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
        const material = new THREE.MeshStandardMaterial({ color: color });
        const cube = new THREE.Mesh(geometry, material);
        
        // Position cubes in 3D space
        const x = (pos.col - cols / 2) * spacing;
        const y = (rows / 2 - pos.row) * spacing;
        const z = 0;
        
        cube.position.set(x, y, z);
        scene3D.add(cube);
    });
    
    // Add trend highlights if enabled
    if (highlightTrends) {
        const allTrends = [];
        
        if (trendHorizontal) {
            const horizontalTrends = detectTrends(displayColorMap, cols, rows, 'horizontal');
            allTrends.push(...horizontalTrends);
        }
        
        if (trendVertical) {
            const verticalTrends = detectTrends(displayColorMap, cols, rows, 'vertical');
            allTrends.push(...verticalTrends);
        }
        
        if (trendDiagonal) {
            const diagonalTrends = detectTrends(displayColorMap, cols, rows, 'diagonal');
            allTrends.push(...diagonalTrends);
        }
        
        // Highlight trends with different material
        const rgb = hexToRgbForHighlight(highlightColorHex);
        const highlightMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(rgb.r / 255, rgb.g / 255, rgb.b / 255),
            emissive: new THREE.Color(rgb.r / 255, rgb.g / 255, rgb.b / 255),
            emissiveIntensity: trendOpacity / 100
        });
        
        allTrends.forEach(trend => {
            trend.forEach(({ row, col }) => {
                const pos = pixelPositions.find(p => p.row === row && p.col === col && p.valid);
                if (!pos) return;
                
                const x = (pos.col - cols / 2) * spacing;
                const y = (rows / 2 - pos.row) * spacing;
                
                // Find existing cube at this position and highlight it
                scene3D.children.forEach(child => {
                    if (child instanceof THREE.Mesh && 
                        Math.abs(child.position.x - x) < 0.01 &&
                        Math.abs(child.position.y - y) < 0.01) {
                        child.material = highlightMaterial;
                    }
                });
            });
        });
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
    canvas.width = width;
    canvas.height = height;
    
    // Generate pixel positions based on arrangement pattern
    pixelPositions = generatePixelPositions(tokens, canvasInfo, arrangementPattern);
    
    // Filter positions based on canvas shape
    pixelPositions = pixelPositions.map(pos => ({
        ...pos,
        valid: isValidPosition(pos, canvasInfo, canvasShape)
    }));
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw each token as a square pixel block
    pixelPositions.forEach((pos) => {
        if (!pos.valid) return;
        
        const color = displayColorMap.get(pos.token) || tokenColorMap.get(pos.token);
        ctx.fillStyle = color;
        ctx.fillRect(pos.x, pos.y, pixelSize, pixelSize);
    });
    
    // Detect and draw trend highlights if enabled
    if (highlightTrends) {
        const allTrends = [];
        
        if (trendHorizontal) {
            const horizontalTrends = detectTrends(displayColorMap, cols, rows, 'horizontal');
            allTrends.push(...horizontalTrends);
        }
        
        if (trendVertical) {
            const verticalTrends = detectTrends(displayColorMap, cols, rows, 'vertical');
            allTrends.push(...verticalTrends);
        }
        
        if (trendDiagonal) {
            const diagonalTrends = detectTrends(displayColorMap, cols, rows, 'diagonal');
            allTrends.push(...diagonalTrends);
        }
        
        // Draw all trend highlights
        allTrends.forEach(trend => {
            drawTrendHighlights([trend]);
        });
    }
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
    
    // Create a high-resolution canvas (4x scale)
    const scale = 4;
    const highResCanvas = document.createElement('canvas');
    const highResCtx = highResCanvas.getContext('2d');
    highResCanvas.width = width * scale;
    highResCanvas.height = height * scale;
    
    // Draw on high-res canvas
    filteredPositions.forEach((pos) => {
        if (!pos.valid) return;
        
        const color = displayColorMap.get(pos.token) || tokenColorMap.get(pos.token);
        highResCtx.fillStyle = color;
        highResCtx.fillRect(pos.x * scale, pos.y * scale, pixelSize * scale, pixelSize * scale);
    });
    
    // Draw trend highlights if enabled
    if (highlightTrends) {
        const allTrends = [];
        
        if (trendHorizontal) {
            const horizontalTrends = detectTrends(displayColorMap, cols, rows, 'horizontal');
            allTrends.push(...horizontalTrends);
        }
        
        if (trendVertical) {
            const verticalTrends = detectTrends(displayColorMap, cols, rows, 'vertical');
            allTrends.push(...verticalTrends);
        }
        
        if (trendDiagonal) {
            const diagonalTrends = detectTrends(displayColorMap, cols, rows, 'diagonal');
            allTrends.push(...diagonalTrends);
        }
        
        // Draw trend highlights on high-res canvas
        const rgb = hexToRgbForHighlight(highlightColorHex);
        const highlightColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${trendOpacity / 100})`;
        const borderColor = `rgba(${Math.max(0, rgb.r - 55)}, ${Math.max(0, rgb.g - 55)}, ${Math.max(0, rgb.b - 55)}, ${Math.min(trendOpacity / 100 + 0.2, 1)})`;
        
        allTrends.forEach(trend => {
            trend.forEach(({ row, col }) => {
                const pos = filteredPositions.find(p => p.row === row && p.col === col);
                if (pos && pos.valid) {
                    const x = pos.x * scale;
                    const y = pos.y * scale;
                    
                    highResCtx.fillStyle = highlightColor;
                    highResCtx.fillRect(x, y, pixelSize * scale, pixelSize * scale);
                    
                    highResCtx.strokeStyle = borderColor;
                    highResCtx.lineWidth = scale;
                    highResCtx.strokeRect(x, y, pixelSize * scale, pixelSize * scale);
                }
            });
        });
    }
    
    // Generate random filename
    const filename = generateRandomFilename('image.png');
    
    // Convert to blob and download
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
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generateRandomFilename('map.json');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Event listeners
textInput.addEventListener('input', () => {
    renderCanvas();
});

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
        canvas.style.display = 'none';
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
        canvas.style.display = 'block';
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

randomizeBtn.addEventListener('click', () => {
    if (currentMode === 'random') {
        randomizeColors();
    } else {
        alert('Re-randomization only works in Random mode. Switch to Random mode first.');
    }
});

exportImageBtn.addEventListener('click', exportHighResImage);
downloadJsonBtn.addEventListener('click', downloadColorMapping);

// Handle window resize for 3D view
window.addEventListener('resize', () => {
    if (view3D && renderer3D && camera3D) {
        const container = canvas3DContainer;
        const width = container.clientWidth;
        const height = container.clientHeight || 600;
        
        camera3D.aspect = width / height;
        camera3D.updateProjectionMatrix();
        renderer3D.setSize(width, height);
    }
});

// Initial render
renderCanvas();