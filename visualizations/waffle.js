d3.csv("data/openalex_works_full.csv").then(rows => {

    const counts = d3.rollup(
        rows,
        v => v.length,
        d => (d.type && d.type.trim() ? d.type.trim() : "unknown")
    );

    let data = Array.from(counts, ([type, count]) => ({ type, count }))
        .sort((a, b) => d3.descending(a.count, b.count));

    const total = d3.sum(data, d => d.count);
    const N_CELLS = 236; 

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


    const fileWidth = 300; 
    const fileHeight = 450;
    const foldSize = 70;   
    const cornerRadius = 25;
    const filePadding = 40; 
    
    const headerHeight = 100; 
    const margin = { top: 60, right: 220, bottom: 60, left: 60 };
    const width = fileWidth + margin.right + margin.left;
    const height = fileHeight + margin.top + margin.bottom;

    const cols = 13; 
    const availableWidth = fileWidth - (filePadding * 2);
    const cellSize = Math.floor(availableWidth / cols); 
    const cellGap = 6; 
    const actualCellSize = cellSize - cellGap;

    const palette = d3.schemeTableau10.concat(d3.schemeSet3);
    const color = d3.scaleOrdinal()
        .domain(data.map(d => d.type))
        .range(palette);

    d3.select("#pubtype_waffle").selectAll("*").remove();

    const svg = d3.select("#pubtype_waffle")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const defs = svg.append("defs");
    const filter = defs.append("filter")
        .attr("id", "drop-shadow-soft")
        .attr("height", "150%")
        .attr("y", "-20%");
    filter.append("feGaussianBlur")
        .attr("in", "SourceAlpha")
        .attr("stdDeviation", 6)
        .attr("result", "blur");
    filter.append("feOffset")
        .attr("in", "blur")
        .attr("dx", 0).attr("dy", 4)
        .attr("result", "offsetBlur");
    filter.append("feComponentTransfer")
        .append("feFuncA").attr("type", "linear").attr("slope", 0.2);
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    function getFilePath(w, h, r, f) {
        return `
            M ${r},0 
            L ${w - f},0           
            L ${w},${f}            
            L ${w},${h - r}        
            a ${r},${r} 0 0 1 -${r},${r} 
            L ${r},${h}            
            a ${r},${r} 0 0 1 -${r},-${r}
            L 0,${r}               
            a ${r},${r} 0 0 1 ${r},-${r}
            Z
        `;
    }

    function getFoldPath(w, f) {
        return `
            M ${w - f},0 
            L ${w - f},${f - 10} 
            a 10,10 0 0 0 10,10 
            L ${w},${f} 
            Z
        `;
    }

    g.append("path")
        .attr("d", getFilePath(fileWidth, fileHeight, cornerRadius, foldSize))
        .attr("fill", "#ffffff")
        .attr("stroke", "#cfd8dc")
        .attr("stroke-width", 1.5)
        .style("filter", "url(#drop-shadow-soft)");

    g.append("path")
        .attr("d", getFoldPath(fileWidth, foldSize))
        .attr("fill", "#f1f3f4")
        .attr("stroke", "#cfd8dc")
        .attr("stroke-width", 1.5)
        .attr("stroke-linejoin", "round");

    g.append("text")
        .attr("x", fileWidth / 2 - 25)
        .attr("y", 60)
        .attr("text-anchor", "middle")
        .style("font-size", "20px")
        .style("font-weight", "700")
        .style("font-family", "'Roboto', sans-serif")
        .text("Publication types");

    const slots = [];
    let r = 0, c = 0;
    const startY = headerHeight; 

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


    let selectedType = null;

    const cells = g.selectAll(".cell")
        .data(cellsData)
        .enter()
        .append("rect")
        .attr("class", "cell")
        .attr("x", d => d.x)
        .attr("y", d => d.y)
        .attr("width", actualCellSize)
        .attr("height", actualCellSize)
        .attr("rx", 5)
        .attr("fill", d => color(d.type))
        .style("cursor", "pointer")
        .attr("stroke", "white")
        .attr("stroke-width", 0.5);

    const legendX = fileWidth + 50; 
    const legendY = 120; 
    const itemHeight = 36;

    const legend = g.append("g").attr("transform", `translate(${legendX}, ${legendY})`);
    const legendItem = legend.selectAll(".legend-item")
        .data(data).enter().append("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(0, ${i * itemHeight})`)
        .style("cursor", "pointer");

    legendItem.append("circle")
        .attr("r",7).attr("cx", 0).attr("cy", 0)
        .attr("fill", d => color(d.type));

    legendItem.append("text")
        .attr("x", 13).attr("y", 3)
        .style("font-family", "'Roboto', sans-serif")
        .style("font-size", "12px")
        .style("font-weight", "500")
        .style("fill", "#2c3e50")
        .text(d => `${d.type} (${d.count.toLocaleString()})`);


    function updateView() {
        cells.transition().duration(250).ease(d3.easeQuadOut)
            .attr("opacity", d => selectedType && d.type !== selectedType ? 0.2 : 1)
            .attr("transform", d => selectedType && d.type === selectedType ? "scale(0.90)" : "scale(1)")
            .style("transform-origin", d => `${d.x + actualCellSize/2}px ${d.y + actualCellSize/2}px`);
        legendItem.transition().duration(250)
            .attr("opacity", d => selectedType && d.type !== selectedType ? 0.3 : 1);
    }

    legendItem.on("mouseenter", (event, d) => { if (!selectedType) cells.attr("opacity", c => c.type === d.type ? 1 : 0.2); })
        .on("mouseleave", () => { if (!selectedType) cells.attr("opacity", 1); })
        .on("click", (event, d) => { selectedType = (selectedType === d.type) ? null : d.type; updateView(); });

    svg.on("click", (event) => {
        if (!event.target.closest(".cell") && !event.target.closest(".legend-item")) { selectedType = null; updateView(); }
    });
});