let rawData = [];
let changePoints = [];
let stats = [];

const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');

// --- 1. CSV Loader (Pure JS) ---
document.getElementById('csvFile').addEventListener('change', e => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
        const lines = event.target.result.split('\n').filter(l => l.trim());
        const headers = lines[0].split(',').map(h => h.trim());
        
        const tsIdx = headers.findIndex(h => h.toLowerCase().includes('timestamp'));
        const valIdx = headers.findIndex(h => h.includes('PM_N'));

        rawData = lines.slice(1).map(line => {
            const cols = line.split(',');
            return { ts: cols[tsIdx], val: parseFloat(cols[valIdx]) };
        }).filter(d => !isNaN(d.val));
        
        analyze();
    };
    reader.readAsText(file);
});

// Update logic for sliders
document.getElementById('sens').oninput = function() { document.getElementById('sensVal').innerText = this.value; analyze(); };
document.getElementById('win').oninput = function() { document.getElementById('winVal').innerText = this.value; analyze(); };

// --- 2. Analysis Logic (Regime Shift) ---
function analyze(algorithm = 'v2') {
    if (algorithm === 'v1') {
        analyze_v1();
    } else {
        analyze_v2();
    }
}

function analyze_v1() {
    if (!rawData.length) return;
    const sens = parseFloat(document.getElementById('sens').value);
    const win = parseInt(document.getElementById('win').value);
    const vals = rawData.map(d => d.val);
    
    changePoints = [0];
    const minGap = win * 2; 

    // Window-to-Window average comparison
    for (let i = win; i < vals.length - win; i++) {
        const left = vals.slice(i - win, i);
        const right = vals.slice(i, i + win);
        
        const leftAvg = left.reduce((a, b) => a + b, 0) / win;
        const rightAvg = right.reduce((a, b) => a + b, 0) / win;
        
        const diff = Math.abs(leftAvg - rightAvg);
        const threshold = sens * 0.8; // Baseline noise filter

        if (diff > threshold) {
            if (i - changePoints[changePoints.length - 1] > minGap) {
                changePoints.push(i);
            }
        }
    }
    changePoints.push(vals.length - 1);

    render();
    calculateStats(vals);
}

function analyze_v2() {
    if (!rawData.length) return;
    const penalty = parseFloat(document.getElementById('sens').value); 
    const win = parseInt(document.getElementById('win').value);
    const n = rawData.length;
    const vals = rawData.map(d => d.val);
    
    // 1. (Trapezoid) 
    let prefix = new Array(n).fill(0);
    for (let i = 1; i < n; i++) {
        prefix[i] = prefix[i-1] + (vals[i-1] + vals[i]) * 0.5;
    }

    // 2. Rolling Area Signal & Rolling Std Dev
    //  RBF (Variance)
    let areaSignal = new Array(n).fill(0);
    let rollingStd = new Array(n).fill(0);

    for (let i = win; i < n; i++) {
        // area
        areaSignal[i] = prefix[i] - prefix[i-win];
        
        // sdt
        let windowVals = vals.slice(i - win, i);
        let mean = windowVals.reduce((a, b) => a + b, 0) / win;
        let variance = windowVals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / win;
        rollingStd[i] = Math.sqrt(variance);
    }

    // 3. Combined Score (Area Change + Variance Change)
    
    changePoints = [0];
    let scores = new Array(n).fill(0);

    for (let i = win + 1; i < n - 1; i++) {
        let areaDiff = Math.abs(areaSignal[i] - areaSignal[i-1]);
        let stdDiff = Math.abs(rollingStd[i] - rollingStd[i-1]);
        
        scores[i] = (areaDiff * 0.7) + (stdDiff * 0.3);
    }

    // 4. Peak Detection with Dynamic Threshold
    const threshold = penalty * (Math.max(...scores) / 10); 
    
    for (let i = win * 2; i < n - win; i++) {
        if (scores[i] > threshold && 
            scores[i] > scores[i-1] && 
            scores[i] > scores[i+1]) {
            
            // Min Distance
            if (i - changePoints[changePoints.length - 1] > win * 1.5) {
                changePoints.push(i);
            }
        }
    }
    
    changePoints.push(n - 1);

    render();
    calculateStats(vals);
}

// --- 3. Visualization ---
function render() {
    const w = canvas.width = canvas.offsetWidth * 2;
    const h = canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight - 40; // padding for labels
    
    const vals = rawData.map(d => d.val);
    const max = Math.max(...vals) * 1.1;
    const step = width / (vals.length - 1);

    ctx.clearRect(0, 0, width, height + 40);

    // Area Fill
    ctx.beginPath();
    ctx.moveTo(0, height);
    vals.forEach((v, i) => ctx.lineTo(i * step, height - (v / max * height)));
    ctx.lineTo(width, height);
    ctx.fillStyle = 'rgba(52, 152, 219, 0.15)';
    ctx.fill();

    // Y=0 Axis
    ctx.beginPath();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.moveTo(0, height);
    ctx.lineTo(width, height);
    ctx.stroke();

    // Data Line
    ctx.beginPath();
    ctx.strokeStyle = '#2980b9';
    ctx.lineWidth = 1.2;
    vals.forEach((v, i) => {
        const x = i * step;
        const y = height - (v / max * height);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Change Point Dashed Lines
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#e74c3c';
    changePoints.slice(1, -1).forEach(cp => {
        ctx.beginPath();
        ctx.moveTo(cp * step, 0);
        ctx.lineTo(cp * step, height);
        ctx.stroke();
    });
    ctx.setLineDash([]);

    // X-Axis Labels (Dates)
    ctx.fillStyle = "#555";
    ctx.font = "10px sans-serif";
    const labelCount = 5;
    for (let i = 0; i < labelCount; i++) {
        const idx = Math.floor((i / (labelCount - 1)) * (vals.length - 1));
        const x = idx * step;
        const text = rawData[idx].ts.split(' ')[0]; // Show date only
        ctx.fillText(text, x - 20, height + 20);
    }
}

// --- 4. Statistics Calculation ---
function calculateStats(vals) {
    const tbody = document.getElementById('statsBody');
    tbody.innerHTML = '';
    stats = [];

    for (let i = 0; i < changePoints.length - 1; i++) {
        const s = changePoints[i], e = changePoints[i+1];
        const seg = vals.slice(s, e + 1);
        
        const mean = seg.reduce((a, b) => a + b, 0) / seg.length;
        const std = Math.sqrt(seg.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / seg.length);
        
        // Area calculation (Sum of trapezoids)
        let areaSum = 0;
        for(let j=s; j < e; j++) areaSum += (vals[j] + vals[j+1]) / 2;

        const row = { id: i+1, start: rawData[s].ts, end: rawData[e].ts, mean: mean.toFixed(2), std: std.toFixed(2), area: areaSum.toFixed(2) };
        stats.push(row);
        tbody.innerHTML += `<tr><td>${row.id}</td><td>${row.start}</td><td>${row.end}</td><td>${row.mean}</td><td>${row.std}</td><td>${row.area}</td></tr>`;
    }
}

function exportStats() {
    let csv = "Segment,Start,End,Mean,StdDev,Area\n";
    stats.forEach(r => csv += `${r.id},${r.start},${r.end},${r.mean},${r.std},${r.area}\n`);
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'change_point_results.csv';
    a.click();
}