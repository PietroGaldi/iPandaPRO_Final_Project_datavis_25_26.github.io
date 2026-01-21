d3.csv("data/openalex_works_full.csv").then(rows => {

    // --- 1. DATA PREPARATION ---
    const counts = d3.rollup(
        rows,
        v => v.length,
        d => (d.type && d.type.trim() ? d.type.trim() : "unknown")
    );

    let data = Array.from(counts, ([type, count]) => ({ type, count }))
        .sort((a, b) => d3.descending(a.count, b.count));

    const total = d3.sum(data, d => d.count);
    const N_CELLS = 236; // Total slots available

    data.forEach(d => {
        d.rawCells = (d.count / total) * N_CELLS;
        d.cells = Math.floor(d.rawCells);
        d.remainder = d.rawCells - d.cells;
    });

    let assigned = d3.sum(data, d => d.cells);
    let remaining = N_CELLS - assigned;
    data.slice()
        .sort((a, b) => d3.descending(a.remainder, b.remainder))
        .slice(0, remaining)
        .forEach(d => d.cells += 1);

    const typeByCellIndex = [];
    let cursor = 0;
    data.forEach(d => {
        for (let i = 0; i < d.cells; i++) {
            typeByCellIndex[cursor++] = d.type;
        }
    });

    // --- 2. CONFIGURATION ---
    const fileWidth = 320; 
    const fileHeight = 460;
    const foldSize = 60;   
    const cornerRadius = 20; 
    
    // Increased padding to make the grid smaller and more centered
    const filePadding = 45; 
    
    const headerHeight = 90; 
    const margin = { top: 40, right: 240, bottom: 40, left: 40 };
    const width = fileWidth + margin.right + margin.left;
    const height = fileHeight + margin.top + margin.bottom;

    const cols = 13; 
    const availableWidth = fileWidth - (filePadding * 2);
    const cellSize = availableWidth / cols; 
    
    // Increased gap to make individual cells smaller and "breathable"
    const cellGap = 6; 
    const actualCellSize = cellSize - cellGap;

    const palette = d3.schemeTableau10.concat(d3.schemeSet3);

    const color = d3.scaleOrdinal()
        .domain(data.map(d => d.type))
        .range(palette);

    // --- 3. SVG SETUP ---
    d3.select("#pubtype_waffle").selectAll("*").remove();

    const svg = d3.select("#pubtype_waffle")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .style("max-width", "100%")
        .style("height", "auto");

    // --- 4. DEFS (Shadows & Gradients) ---
    const defs = svg.append("defs");

    // Realistic Paper Shadow
    const filter = defs.append("filter")
        .attr("id", "paper-shadow")
        .attr("height", "150%").attr("width", "150%");
    filter.append("feGaussianBlur")
        .attr("in", "SourceAlpha").attr("stdDeviation", 4).attr("result", "blur");
    filter.append("feOffset")
        .attr("in", "blur").attr("dx", 2).attr("dy", 4).attr("result", "offsetBlur");
    filter.append("feComponentTransfer")
        .append("feFuncA").attr("type", "linear").attr("slope", 0.15);
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Fold Gradient
    const foldGradient = defs.append("linearGradient")
        .attr("id", "fold-gradient")
        .attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "100%");
    foldGradient.append("stop").attr("offset", "0%").attr("stop-color", "#f0f0f0");
    foldGradient.append("stop").attr("offset", "50%").attr("stop-color", "#e0e0e0");
    foldGradient.append("stop").attr("offset", "100%").attr("stop-color", "#ffffff");

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // --- 5. DRAW PAPER ---
    function getFilePath(w, h, r, f) {
        return `
            M 0,${r} 
            a ${r},${r} 0 0 1 ${r},-${r}
            L ${w - f},0           
            L ${w},${f}            
            L ${w},${h - r}        
            a ${r},${r} 0 0 1 -${r},${r} 
            L ${r},${h}            
            a ${r},${r} 0 0 1 -${r},-${r}
            Z
        `;
    }

    function getFoldPath(w, f) {
        return `
            M ${w - f},0 
            L ${w - f},${f - 6} 
            a 6,6 0 0 0 6,6 
            L ${w},${f} 
            Z
        `;
    }

    // Main Paper Body
    g.append("path")
        .attr("d", getFilePath(fileWidth, fileHeight, cornerRadius, foldSize))
        .attr("fill", "#ffffff")
        .attr("stroke", "#e2e8f0")
        .attr("stroke-width", 1)
        .style("filter", "url(#paper-shadow)");

    // Decorative Header Bar (Using a softer blue from the new palette)
    g.append("rect")
        .attr("x", 0).attr("y", 20)
        .attr("width", 6).attr("height", 40)
        .attr("fill", "#5B73E8") 
        .attr("rx", 2);

    // Folded Corner
    g.append("path")
        .attr("d", getFoldPath(fileWidth, foldSize))
        .attr("fill", "url(#fold-gradient)")
        .attr("stroke", "#d1d5db")
        .attr("stroke-width", 0.5);

    // Header Text
    g.append("text")
        .attr("class", "waffle-text")
        .attr("x", filePadding)
        .attr("y", 50)
        .attr("text-anchor", "start")
        .style("font-size", "18px")
        .style("font-weight", "800")
        .style("fill", "#1e293b")
        .text("Publication Types");
    
    g.append("text")
        .attr("class", "waffle-text")
        .attr("x", filePadding)
        .attr("y", 72)
        .attr("text-anchor", "start")
        .style("font-size", "14px")
        .style("fill", "#64748b")
        .text(`Total Publications: ${total.toLocaleString()}`);

    // --- 6. CALCULATE GRID ---
    const slots = [];
    let r = 0, c = 0;
    const startY = headerHeight + 10; // Added a little extra top padding for the grid

    while (slots.length < N_CELLS) {
        const xPos = filePadding + (c * cellSize);
        const yPos = startY + (r * cellSize);
        
        const inFoldArea = (xPos > (fileWidth - foldSize - filePadding)) && (yPos < (foldSize + 10));

        if (!inFoldArea) {
            slots.push({ r, c, x: xPos, y: yPos });
        }
        c++;
        if (c >= cols) { c = 0; r++; }
    }

    const cellsData = slots.map((pos, i) => ({...pos, type: typeByCellIndex[i], i: i}));

    // --- 7. DRAW CELLS (STATIC) ---
    const cellGroup = g.append("g").attr("class", "cells-group");

    cellGroup.selectAll(".cell")
        .data(cellsData)
        .enter()
        .append("rect") 
        .attr("class", "cell")
        .attr("x", d => d.x)
        .attr("y", d => d.y)
        .attr("width", actualCellSize)
        .attr("height", actualCellSize)
        .attr("rx", actualCellSize / 1.5) 
        .attr("fill", d => color(d.type))
        .attr("stroke", "white")
        .attr("stroke-width", 0.5);

    // --- 8. LEGEND (CENTERED) ---
    const legendX = fileWidth + 40; 
    const itemHeight = 32;

    const legendTotalHeight = data.length * itemHeight;

    const legendY = (fileHeight - legendTotalHeight) / 2 + 10;

    const legend = g.append("g").attr("transform", `translate(${legendX}, ${legendY})`);
    
    legend.append("text")
        .attr("class", "waffle-text")
        .attr("x", 0).attr("y", -20)
        .style("font-size", "12px")
        .style("font-weight", "700")
        .style("fill", "#94a3b8")
        .style("text-transform", "uppercase")
        .style("letter-spacing", "0.05em")
        .text("Categories");

    const legendItem = legend.selectAll(".legend-item")
        .data(data).enter().append("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(0, ${i * itemHeight})`);

    // Circle indicators
    legendItem.append("circle")
        .attr("r", 6)
        .attr("cx", 6)
        .attr("cy", 0)
        .attr("fill", d => color(d.type));

    legendItem.append("text")
        .attr("class", "waffle-text")
        .attr("x", 20).attr("y", 4)
        .style("font-size", "13px")
        .style("font-weight", "500")
        .style("font-family", "Fira Sans")
        .style("fill", "#475569")
        .text(d => d.type);
    
    legendItem.append("text")
        .attr("class", "waffle-text")
        .attr("x", 170).attr("y", 4)
        .attr("text-anchor", "end")
        .style("font-size", "12px")
        .style("font-weight", "700")
        .style("fill", "#94a3b8")
        .text(d => d.count.toLocaleString());
});