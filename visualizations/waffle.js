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
    d.pct = (d.count / total) * 100;
  });

  let assigned = d3.sum(data, d => d.cells);
  let remaining = N_CELLS - assigned;

  data
    .slice()
    .sort((a, b) => d3.descending(a.remainder, b.remainder))
    .slice(0, remaining)
    .forEach(d => d.cells += 1);

  const cellSize = 18;
  const cellGap = 3;

  const waffleCols = 20;
  const waffleRows = 12;

  const waffleWidth = waffleCols * (cellSize + cellGap) - cellGap;
  const waffleHeight = waffleRows * (cellSize + cellGap) - cellGap;

  const margin = { top: 70, right: 36, bottom: 140, left: 36 };
  const width = margin.left + waffleWidth + margin.right;
  const height = margin.top + waffleHeight + margin.bottom;

  const palette = d3.schemeTableau10.concat(d3.schemeSet3);
  const color = d3.scaleOrdinal()
    .domain(data.map(d => d.type))
    .range(palette);

  const typeByCellIndex = [];
  let cursor = 0;
  data.forEach(d => {
    for (let i = 0; i < d.cells; i++) {
      typeByCellIndex[cursor++] = d.type;
    }
  });

  const cellsData = d3.range(N_CELLS).map(i => {
    const row = Math.floor(i / waffleCols);
    const col = i % waffleCols;
    return {
      row,
      col,
      type: typeByCellIndex[i],
      i: i
    };
  });

  d3.select("#pubtype_waffle").selectAll("*").remove();

  const tip = d3.select("body")
    .selectAll("div.waffle-tip")
    .data([null])
    .join("div")
    .attr("class", "waffle-tip")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("padding", "8px 10px")
    .style("background", "rgba(20,20,20,0.9)")
    .style("color", "#ffffff")
    .style("border-radius", "8px")
    .style("font-size", "12px")
    .style("box-shadow", "0 6px 18px rgba(0,0,0,0.2)")
    .style("opacity", 0);

  // SVG
  const svg = d3.select("#pubtype_waffle")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  // Title
  const title = svg.append("text")
    .attr("x", width / 2)
    .attr("y", 30)
    .attr("text-anchor", "middle")
    .style("font-size", "20px")
    .style("font-weight", "700")
    .text("Publication types");

  const subtitle = svg.append("text")
    .attr("x", width / 2)
    .attr("y", 52)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .style("fill", "#666")
    .text("Dataset size: " + total.toLocaleString() + " works, waffle cells: " + N_CELLS);

  const g = svg.append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  g.append("rect")
    .attr("x", -14)
    .attr("y", -14)
    .attr("width", waffleWidth + 28)
    .attr("height", waffleHeight + 28)
    .attr("fill", "#fafafa")
    .attr("stroke", "#e0e0e0")
    .attr("rx", 12);

  let selectedType = null;

  function setSubtitleForType(type) {
    if (!type) {
      subtitle.text("Dataset size: " + total.toLocaleString() + " works, waffle cells: " + N_CELLS);
      return;
    }
    const meta = data.find(x => x.type === type);
    subtitle.text(
      "Selected: " + meta.type +
      " | " + meta.count.toLocaleString() + " works" +
      " | " + meta.pct.toFixed(1) + " percent" +
      " | click again to reset"
    );
  }

  function applySelection() {
    cells
      .transition()
      .duration(150)
      .attr("opacity", d => {
        if (!selectedType) return 1;
        return d.type === selectedType ? 1 : 0.15;
      })
      .attr("stroke-width", d => {
        if (!selectedType) return 1;
        return d.type === selectedType ? 2 : 1;
      })
      .attr("stroke", d => {
        if (!selectedType) return "#ffffff";
        return d.type === selectedType ? "rgba(0,0,0,0.25)" : "#ffffff";
      });
  }

  const cells = g.selectAll("rect.cell")
    .data(cellsData)
    .enter()
    .append("rect")
    .attr("class", "cell")
    .attr("x", d => d.col * (cellSize + cellGap))
    .attr("y", d => d.row * (cellSize + cellGap))
    .attr("width", cellSize)
    .attr("height", cellSize)
    .attr("rx", 4)
    .attr("fill", d => d.type ? color(d.type) : "#eeeeee")
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 1)
    .style("cursor", "pointer");

  cells
    .on("mouseenter", function (event, d) {
      if (!d.type) return;

      d3.select(this)
        .raise()
        .attr("stroke", "rgba(0,0,0,0.35)")
        .attr("stroke-width", 2);
    })
    .on("mousemove", (event, d) => {
      if (!d.type) return;
      const meta = data.find(x => x.type === d.type);

      tip
        .style("opacity", 1)
        .html(
          "<strong>" + meta.type + "</strong><br>" +
          meta.count.toLocaleString() + " works<br>" +
          meta.pct.toFixed(1) + " percent<br>" +
          "Click to filter"
        )
        .style("left", (event.pageX + 12) + "px")
        .style("top", (event.pageY - 12) + "px");
    })
    .on("mouseleave", function (event, d) {
      tip.style("opacity", 0);

      if (!selectedType) {
        d3.select(this)
          .attr("stroke", "#ffffff")
          .attr("stroke-width", 1);
      } else {
        if (d.type === selectedType) {
          d3.select(this)
            .attr("stroke", "rgba(0,0,0,0.25)")
            .attr("stroke-width", 2);
        } else {
          d3.select(this)
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 1);
        }
      }
    });

  cells.on("click", (event, d) => {
    if (!d.type) return;

    if (selectedType === d.type) {
      selectedType = null;
      setSubtitleForType(null);
    } else {
      selectedType = d.type;
      setSubtitleForType(selectedType);
    }
    applySelection();
  });

  const legend = svg.append("g")
    .attr("transform", "translate(" + margin.left + "," + (margin.top + waffleHeight + 40) + ")");

  const itemsPerRow = 2;
  const colW = 300;
  const rowH = 22;

  const legendItem = legend.selectAll("g.item")
    .data(data)
    .enter()
    .append("g")
    .attr("class", "item")
    .attr("transform", (d, i) => {
      const col = i % itemsPerRow;
      const row = Math.floor(i / itemsPerRow);
      return "translate(" + (col * colW) + "," + (row * rowH) + ")";
    })
    .style("cursor", "pointer");

  legendItem.append("circle")
    .attr("r", 6)
    .attr("cy", 0)
    .attr("cx", 6)
    .attr("fill", d => color(d.type));

  legendItem.append("text")
    .attr("x", 18)
    .attr("y", 3)
    .style("font-size", "12px")
    .text(d => d.type + " - " + d.pct.toFixed(1) + "%");

  legendItem
    .on("mouseenter", (event, d) => {
      cells
        .attr("opacity", c => (c.type === d.type ? 1 : (selectedType ? (c.type === selectedType ? 1 : 0.15) : 0.12)));
    })
    .on("mouseleave", () => {
      applySelection();
    });

  legendItem.on("click", (event, d) => {
    if (selectedType === d.type) {
      selectedType = null;
      setSubtitleForType(null);
    } else {
      selectedType = d.type;
      setSubtitleForType(selectedType);
    }
    applySelection();
  });

  svg.on("click", (event) => {
    const t = event.target;
    const clickedCell = t && t.classList && t.classList.contains("cell");
    const clickedLegend = t && t.closest && t.closest("g.item");
    if (clickedCell || clickedLegend) return;

    selectedType = null;
    setSubtitleForType(null);
    applySelection();
  });
});
