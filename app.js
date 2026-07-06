const canvas = document.getElementById('paintCanvas');
const ctx = canvas.getContext('2d');

let isDrawing = false;
let startX, startY;
let currentTool = 'brush';
let snapshot;
let history = [];
let currentBrush = 'brush';
const brushSelect = document.getElementById('brushSelect');
if (brushSelect) {
    brushSelect.addEventListener('change', (e) => {
        currentBrush = e.target.value;
    });
}

// Update size display
document.getElementById('sizeSlider').addEventListener('input', (e) => {
    document.getElementById('sizeDisplay').textContent = e.target.value;
});
// Opacity slider display
const opacitySlider = document.getElementById('opacitySlider');
if (opacitySlider) {
    opacitySlider.addEventListener('input', (e) => {
        const v = e.target.value;
        const disp = document.getElementById('opacityDisplay');
        if (disp) disp.textContent = v;
    });
}

// Save canvas state to history
function saveToHistory() {
    history.push(canvas.toDataURL());
    // Limit history to 20 states
    if (history.length > 20) {
        history.shift();
    }
}

// Undo last stroke
function undoLastStroke() {
    if (history.length > 0) {
        const previousState = history.pop();
        const img = new Image();
        img.src = previousState;
        img.onload = function() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        };
    }
}

// Mouse Down Event
canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    saveToHistory();
    
    const rect = canvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    
    // base styles
    ctx.beginPath();
    ctx.strokeStyle = document.getElementById('colorPicker').value;
    ctx.fillStyle = document.getElementById('colorPicker').value;
    ctx.lineWidth = Number(document.getElementById('sizeSlider').value);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-over';

    // apply brush preset
    applyBrushSettings();

    // initialize last positions for dynamics
    lastX = startX; lastY = startY;

    if (currentTool === 'brush') {
        ctx.moveTo(startX, startY);
        ctx.lineTo(startX, startY);
        ctx.stroke();
    } else {
        // Save canvas state for shape preview
        snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
});

// Mouse Move Event
canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    
    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    if (currentTool === 'brush') {
        if (currentBrush === 'spray') {
            sprayAt(currentX, currentY);
        } else if (currentBrush === 'splatter') {
            sprayAt(currentX, currentY, {densityMult: 1.6, radiusMult: 1.6});
        
        } else if (currentBrush === 'chalk') {
            chalkStroke(currentX, currentY);
        
        } else if (currentBrush === 'pattern') {
            patternStroke(currentX, currentY);
        } else if (currentBrush === 'confetti') {
            confettiAt(currentX, currentY);
        } else if (currentBrush === 'textured' || currentBrush === 'charcoal' || currentBrush === 'watercolor') {
            texturedStroke(currentX, currentY);
        } else if (currentBrush === 'ink') {
            // slightly firmer, immediate strokes
            applyBrushDynamics(currentX, currentY);
        } else if (currentBrush === 'glow') {
            // glow uses regular dynamics but keeps a larger shadow
            applyBrushDynamics(currentX, currentY);
        } else {
            // normal stroke for brush, soft, marker, calligraphy, eraser
            applyBrushDynamics(currentX, currentY);
        }
    } else {
        // Restore frame before drawing preview shape
        ctx.putImageData(snapshot, 0, 0);
        drawShape(currentX, currentY);
    }
});

// Mouse Up Event
// mouseup handled below (finalizes shapes)

// Ensure final shape is drawn when mouse is released (in case of no move)
canvas.addEventListener('mouseup', (e) => {
    // compute end coords and draw final shape if using shapes
    if (currentTool !== 'brush') {
        const rect = canvas.getBoundingClientRect();
        const endX = e.clientX - rect.left;
        const endY = e.clientY - rect.top;
        // restore snapshot (clear preview) then draw final shape onto canvas
        if (snapshot) ctx.putImageData(snapshot, 0, 0);
        // ensure fill/stroke styles are set correctly
        ctx.fillStyle = document.getElementById('colorPicker').value;
        ctx.strokeStyle = document.getElementById('colorPicker').value;
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = ctx._baseAlpha || 1;
        drawShape(endX, endY);
    }
    isDrawing = false;
});

// Mouse Leave Event
canvas.addEventListener('mouseleave', () => {
    isDrawing = false;
    ctx.globalAlpha = 1;
});

// Drawing Helper for Shapes
function drawShape(endX, endY) {
    const isFilled = document.getElementById('fillCheck').checked;
    ctx.beginPath();

    if (currentTool === 'rect') {
        const width = endX - startX;
        const height = endY - startY;
        if (isFilled) {
            ctx.fillRect(startX, startY, width, height);
        } else {
            ctx.strokeRect(startX, startY, width, height);
        }
    } else if (currentTool === 'circle') {
        const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
        if (isFilled) {
            ctx.fill();
        } else {
            ctx.stroke();
        }
    } else if (currentTool === 'star') {
        // Draw a star centered at startX,startY with outer radius based on drag distance
        const outerRadius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        const points = 5;
        const innerRadius = Math.max(4, outerRadius * 0.45);
        const step = Math.PI / points;
        ctx.beginPath();
        for (let i = 0; i < 2 * points; i++) {
            const r = (i % 2 === 0) ? outerRadius : innerRadius;
            const a = -Math.PI / 2 + i * step;
            const x = startX + Math.cos(a) * r;
            const y = startY + Math.sin(a) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        if (isFilled) ctx.fill();
        else ctx.stroke();
    }
}

// Apply brush settings based on currentBrush
function applyBrushSettings() {
    const size = Number(document.getElementById('sizeSlider').value);
    const color = document.getElementById('colorPicker').value;

    ctx.shadowBlur = 0;
    ctx.shadowColor = color;
    const baseAlpha = Number(document.getElementById('opacitySlider')?.value || 100) / 100;
    ctx._baseAlpha = baseAlpha;
    ctx.globalAlpha = baseAlpha;
    ctx.globalCompositeOperation = 'source-over';

    // base line width stored so dynamics don't multiply repeatedly
    ctx._baseLineWidth = size;

    switch (currentBrush) {
        
        case 'marker':
            ctx.globalAlpha = 0.55 * ctx._baseAlpha;
            ctx._baseLineWidth = Math.max(2, size * 1.4);
            ctx.lineWidth = ctx._baseLineWidth;
            ctx.lineCap = 'round';
            break;
        case 'charcoal':
            ctx.globalAlpha = 0.85 * ctx._baseAlpha;
            ctx._baseLineWidth = Math.max(2, size * 1.3);
            ctx.lineWidth = ctx._baseLineWidth;
            ctx.shadowBlur = 0;
            break;
        case 'ink':
            ctx.globalAlpha = 0.98 * ctx._baseAlpha;
            ctx._baseLineWidth = Math.max(1, size * 0.9);
            ctx.lineWidth = ctx._baseLineWidth;
            ctx.lineCap = 'round';
            break;
        case 'watercolor':
            ctx.globalAlpha = 0.25 * ctx._baseAlpha;
            ctx._baseLineWidth = Math.max(6, size * 1.6);
            ctx.lineWidth = ctx._baseLineWidth;
            ctx.shadowBlur = Math.max(2, size * 0.6);
            break;
        case 'glow':
            ctx.globalAlpha = 0.9 * ctx._baseAlpha;
            ctx._baseLineWidth = Math.max(2, size * 1.2);
            ctx.lineWidth = ctx._baseLineWidth;
            ctx.shadowBlur = Math.max(8, size * 1.8);
            ctx.shadowColor = color;
            break;
        case 'splatter':
            ctx.globalAlpha = 0.9 * ctx._baseAlpha;
            ctx._baseLineWidth = Math.max(1, size * 0.6);
            ctx.lineWidth = ctx._baseLineWidth;
            break;
        case 'chalk':
            ctx.globalAlpha = 0.9 * ctx._baseAlpha;
            ctx._baseLineWidth = Math.max(2, size * 0.9);
            ctx.lineWidth = ctx._baseLineWidth;
            break;
        
        case 'pattern':
            ctx.globalAlpha = 0.95 * ctx._baseAlpha;
            ctx._baseLineWidth = Math.max(1, size * 0.6);
            ctx.lineWidth = ctx._baseLineWidth;
            break;
        case 'confetti':
            ctx.globalAlpha = 1 * ctx._baseAlpha;
            ctx._baseLineWidth = 1;
            ctx.lineWidth = ctx._baseLineWidth;
            break;
        case 'calligraphy':
            ctx._baseLineWidth = Math.max(2, size * 1.6);
            ctx.lineWidth = ctx._baseLineWidth;
            ctx.lineCap = 'butt';
            break;
        case 'eraser':
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = Math.max(8, size * 1.8);
            break;
        default:
            // brush and textured and spray
            ctx.lineWidth = size;
            ctx.lineCap = 'round';
    }
}

// Apply dynamics for regular strokes: adapt width for calligraphy and draw path
let lastX = 0, lastY = 0;
function applyBrushDynamics(x, y) {
    const dx = x - lastX;
    const dy = y - lastY;
    const speed = Math.sqrt(dx*dx + dy*dy);
    if (currentBrush === 'calligraphy') {
        // scale relative to the base line width to avoid runaway growth
        const factor = 1 + Math.min(1, speed / 10);
        ctx.lineWidth = Math.max(1, (ctx._baseLineWidth || ctx.lineWidth) * factor);
    
    }
    if (currentBrush === 'marker' || currentBrush === 'brush' || currentBrush === 'calligraphy' || currentBrush === 'ink' || currentBrush === 'glow') {
        ctx.lineTo(x, y);
        ctx.stroke();
    } else if (currentBrush === 'eraser') {
        ctx.lineTo(x, y);
        ctx.stroke();
    }
    lastX = x; lastY = y;
}

// Spray effect: scatter dots around point
// Spray effect: scatter dots around point. Accepts optional multipliers.
function sprayAt(x, y, opts = {}) {
    const size = Number(document.getElementById('sizeSlider').value);
    const densityBase = Math.max(15, size * 4);
    const radiusBase = Math.max(8, size * 0.8);
    const density = Math.floor(densityBase * (opts.densityMult || 1));
    const radius = radiusBase * (opts.radiusMult || 1);
    ctx.fillStyle = document.getElementById('colorPicker').value;
    for (let i = 0; i < density; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = radius * Math.sqrt(Math.random());
        const rx = x + Math.cos(angle) * r;
        const ry = y + Math.sin(angle) * r;
        ctx.beginPath();
        ctx.arc(rx, ry, Math.random() * 1.6 + 0.3, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Textured stroke: draw many small offset circles along the path
function texturedStroke(x, y) {
    const size = Number(document.getElementById('sizeSlider').value);
    ctx.fillStyle = document.getElementById('colorPicker').value;
    const count = Math.max(3, Math.floor(size / 2));
    for (let i = 0; i < count; i++) {
        const rx = x + (Math.random() - 0.5) * size * 0.9;
        const ry = y + (Math.random() - 0.5) * size * 0.9;
        ctx.beginPath();
        ctx.arc(rx, ry, Math.random() * (size/3) + 0.5, 0, Math.PI * 2);
        ctx.fill();
    }
}

// (neon removed - use 'glow')

// Chalk: rough, grainy dabs
function chalkStroke(x, y) {
    const size = Number(document.getElementById('sizeSlider').value);
    ctx.fillStyle = document.getElementById('colorPicker').value;
    const grains = Math.max(4, Math.floor(size / 1.8));
    const prevAlpha = ctx.globalAlpha || 1;
    for (let i = 0; i < grains; i++) {
        const rx = x + (Math.random() - 0.5) * size * 1.2;
        const ry = y + (Math.random() - 0.5) * size * 1.2;
        const a = 0.6 + Math.random() * 0.4;
        ctx.globalAlpha = a * (ctx._baseAlpha || prevAlpha);
        ctx.beginPath();
        ctx.arc(rx, ry, Math.random() * (size/3) + 0.6, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = prevAlpha;
}

// (stamp removed)

// Pattern stroke: draw tiny rotated rectangles along path
function patternStroke(x, y) {
    const size = Number(document.getElementById('sizeSlider').value);
    const w = Math.max(2, Math.floor(size / 2));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((Math.random() - 0.5) * 0.8);
    ctx.fillStyle = document.getElementById('colorPicker').value;
    ctx.fillRect(-w/2, -w/2, w, w*1.5);
    ctx.restore();
}

// Confetti: scatter small colored rectangles
function confettiAt(x, y) {
    const size = Number(document.getElementById('sizeSlider').value);
    const count = Math.max(2, Math.floor(size / 3));
    for (let i = 0; i < count; i++) {
        const rx = x + (Math.random() - 0.5) * size * 1.6;
        const ry = y + (Math.random() - 0.5) * size * 1.6;
        const w = Math.random() * (size/3) + 1;
        ctx.fillStyle = `hsl(${Math.floor(Math.random()*360)},70%,60%)`;
        ctx.fillRect(rx, ry, w, w*0.6);
    }
}

// Toolbar Configuration Functions
function setTool(tool) {
    currentTool = tool;
    // remove active from all tool buttons (those with data-tool)
    document.querySelectorAll('[data-tool]').forEach(btn => btn.classList.remove('active'));
    const el = document.querySelector(`[data-tool="${tool}"]`);
    if (el) el.classList.add('active');
}

function clearCanvas() {
    if (confirm('Are you sure you want to clear the canvas?')) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        history = [];
    }
}

async function sendToGame() {
    const gameUrl = document.getElementById('gameUrl').value.trim();
    // Convert canvas to a Blob, then either upload to game URL or download
    canvas.toBlob(async (blob) => {
        if (!blob) {
            alert('Could not export image.');
            return;
        }
        if (gameUrl) {
            try {
                const form = new FormData();
                form.append('file', blob, 'harmony-art-' + Date.now() + '.png');

                const res = await fetch(gameUrl, {
                    method: 'POST',
                    body: form
                });

                if (res.ok) {
                    alert('✅ Uploaded to game successfully!');
                } else {
                    const text = await res.text();
                    alert('Upload failed: ' + res.status + '\n' + text);
                }
            } catch (err) {
                alert('Upload error: ' + err.message);
            }
        } else {
            // Fallback: download as PNG
            const dataURL = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = dataURL;
            link.download = 'harmony-art-' + new Date().getTime() + '.png';
            link.click();
            alert('✅ Canvas exported successfully!\n\nYour artwork has been downloaded as PNG.');
        }
    }, 'image/png');
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') {
        undoLastStroke();
    }
});
