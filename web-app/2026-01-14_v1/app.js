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
const randomizeBtn = document.getElementById('randomizeBtn');
const exportImageBtn = document.getElementById('exportImageBtn');
const downloadJsonBtn = document.getElementById('downloadJsonBtn');
const canvas = document.getElementById('colorCanvas');
const ctx = canvas.getContext('2d');

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

// Calculate canvas dimensions for square grid
function calculateCanvasSize(tokens, pixelSize) {
    if (tokens.length === 0) {
        return { width: 0, height: 0, cols: 0, rows: 0 };
    }
    
    const cols = Math.ceil(Math.sqrt(tokens.length));
    const rows = Math.ceil(tokens.length / cols);
    
    return {
        width: cols * pixelSize,
        height: rows * pixelSize,
        cols: cols,
        rows: rows
    };
}

// Get color at grid position
function getColorAtPosition(tokens, displayColorMap, cols, row, col) {
    const index = row * cols + col;
    if (index >= 0 && index < tokens.length) {
        const token = tokens[index];
        return displayColorMap.get(token) || tokenColorMap.get(token);
    }
    return null;
}

// Detect trends in a specific direction
function detectTrends(tokens, displayColorMap, cols, rows, direction) {
    const trends = [];
    const maxDistance = getMaxColorDistance();
    const thresholdDistance = (trendSimilarity / 100) * maxDistance;
    const highlightColor = `rgba(255, 255, 0, ${trendOpacity / 100})`; // Yellow highlight
    
    if (direction === 'horizontal') {
        // Check horizontal trends (left to right)
        for (let row = 0; row < rows; row++) {
            let currentTrend = [];
            let lastColor = null;
            
            for (let col = 0; col < cols; col++) {
                const color = getColorAtPosition(tokens, displayColorMap, cols, row, col);
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
                const color = getColorAtPosition(tokens, displayColorMap, cols, row, col);
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
                const color = getColorAtPosition(tokens, displayColorMap, cols, row, col);
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
                trends.push({ ...currentTrend, direction: 'diagonal' });
            }
        }
        
        // Check diagonals starting from left edge
        for (let startCol = 1; startCol < cols; startCol++) {
            let currentTrend = [];
            let lastColor = null;
            
            for (let offset = 0; offset < Math.min(rows, cols - startCol); offset++) {
                const row = offset;
                const col = startCol + offset;
                const color = getColorAtPosition(tokens, displayColorMap, cols, row, col);
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
                trends.push({ ...currentTrend, direction: 'diagonal' });
            }
        }
        
        // Check anti-diagonals (top-right to bottom-left)
        for (let startRow = 0; startRow < rows; startRow++) {
            let currentTrend = [];
            let lastColor = null;
            
            for (let offset = 0; offset < Math.min(rows - startRow, cols); offset++) {
                const row = startRow + offset;
                const col = cols - 1 - offset;
                const color = getColorAtPosition(tokens, displayColorMap, cols, row, col);
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
                trends.push({ ...currentTrend, direction: 'diagonal' });
            }
        }
        
        // Check anti-diagonals starting from right edge
        for (let startCol = cols - 2; startCol >= 0; startCol--) {
            let currentTrend = [];
            let lastColor = null;
            
            for (let offset = 0; offset < Math.min(rows, startCol + 1); offset++) {
                const row = offset;
                const col = startCol - offset;
                const color = getColorAtPosition(tokens, displayColorMap, cols, row, col);
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
                trends.push({ ...currentTrend, direction: 'diagonal' });
            }
        }
    }
    
    return trends;
}

// Draw trend highlights on canvas
function drawTrendHighlights(trends) {
    if (!highlightTrends || trends.length === 0) return;
    
    const highlightColor = `rgba(255, 255, 0, ${trendOpacity / 100})`;
    const borderColor = `rgba(255, 200, 0, ${Math.min(trendOpacity / 100 + 0.2, 1)})`;
    
    trends.forEach(trend => {
        trend.forEach(({ row, col }) => {
            const x = col * pixelSize;
            const y = row * pixelSize;
            
            // Draw highlight overlay
            ctx.fillStyle = highlightColor;
            ctx.fillRect(x, y, pixelSize, pixelSize);
            
            // Draw border for better visibility
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, pixelSize, pixelSize);
        });
    });
}

// Render tokens on canvas
function renderCanvas() {
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
    
    const { width, height, cols, rows } = calculateCanvasSize(tokens, pixelSize);
    canvas.width = width;
    canvas.height = height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw each token as a square pixel block
    tokens.forEach((token, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const x = col * pixelSize;
        const y = row * pixelSize;
        
        const color = displayColorMap.get(token) || tokenColorMap.get(token);
        ctx.fillStyle = color;
        ctx.fillRect(x, y, pixelSize, pixelSize);
    });
    
    // Detect and draw trend highlights if enabled
    if (highlightTrends) {
        const allTrends = [];
        
        if (trendHorizontal) {
            const horizontalTrends = detectTrends(tokens, displayColorMap, cols, rows, 'horizontal');
            allTrends.push(...horizontalTrends);
        }
        
        if (trendVertical) {
            const verticalTrends = detectTrends(tokens, displayColorMap, cols, rows, 'vertical');
            allTrends.push(...verticalTrends);
        }
        
        if (trendDiagonal) {
            const diagonalTrends = detectTrends(tokens, displayColorMap, cols, rows, 'diagonal');
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
    
    // Create a high-resolution canvas (4x scale)
    const scale = 4;
    const highResCanvas = document.createElement('canvas');
    const highResCtx = highResCanvas.getContext('2d');
    
    const { width, height, cols, rows } = calculateCanvasSize(tokens, pixelSize);
    highResCanvas.width = width * scale;
    highResCanvas.height = height * scale;
    
    // Draw on high-res canvas
    tokens.forEach((token, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const x = col * pixelSize * scale;
        const y = row * pixelSize * scale;
        
        const color = displayColorMap.get(token) || tokenColorMap.get(token);
        highResCtx.fillStyle = color;
        highResCtx.fillRect(x, y, pixelSize * scale, pixelSize * scale);
    });
    
    // Draw trend highlights if enabled
    if (highlightTrends) {
        const allTrends = [];
        
        if (trendHorizontal) {
            const horizontalTrends = detectTrends(tokens, displayColorMap, cols, rows, 'horizontal');
            allTrends.push(...horizontalTrends);
        }
        
        if (trendVertical) {
            const verticalTrends = detectTrends(tokens, displayColorMap, cols, rows, 'vertical');
            allTrends.push(...verticalTrends);
        }
        
        if (trendDiagonal) {
            const diagonalTrends = detectTrends(tokens, displayColorMap, cols, rows, 'diagonal');
            allTrends.push(...diagonalTrends);
        }
        
        // Draw trend highlights on high-res canvas
        const highlightColor = `rgba(255, 255, 0, ${trendOpacity / 100})`;
        const borderColor = `rgba(255, 200, 0, ${Math.min(trendOpacity / 100 + 0.2, 1)})`;
        
        allTrends.forEach(trend => {
            trend.forEach(({ row, col }) => {
                const x = col * pixelSize * scale;
                const y = row * pixelSize * scale;
                
                highResCtx.fillStyle = highlightColor;
                highResCtx.fillRect(x, y, pixelSize * scale, pixelSize * scale);
                
                highResCtx.strokeStyle = borderColor;
                highResCtx.lineWidth = scale;
                highResCtx.strokeRect(x, y, pixelSize * scale, pixelSize * scale);
            });
        });
    }
    
    // Convert to blob and download
    highResCanvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'token-color-map.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
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
    a.download = 'color-mapping.json';
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

randomizeBtn.addEventListener('click', () => {
    if (currentMode === 'random') {
        randomizeColors();
    } else {
        alert('Re-randomization only works in Random mode. Switch to Random mode first.');
    }
});

exportImageBtn.addEventListener('click', exportHighResImage);
downloadJsonBtn.addEventListener('click', downloadColorMapping);

// Initial render
renderCanvas();