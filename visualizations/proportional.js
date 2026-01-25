(() => {
  const CSV = "data/openalex_works_full.csv";
  const YEARS = [2023, 2024, 2025];
  const CHART_H = 550;
  const TOP_N_DEFAULT = 12;

  const LOGOS = [
    { isVip: true, re: /universit[aà]\s+di\s+genova|unige|university\s+of\s+genoa/i, url: "https://id.unige.it/sites/id.unige.it/files/2022-02/logo_orizzontale_BLACK.png?itok=CJSjqJjK" },
    { isVip: true, re: /\bcnr\b|national\s+research\s+council/i, url: "https://avatars.githubusercontent.com/u/52047892?s=280&v=4" },
    { isVip: true, re: /\biit\b|istituto\s+italiano\s+di\s+tecnologia|italian\s+institute\s+of\s+technology/i, url: "https://www.iit.it/o/iit-theme/images/IIT-v4-logo-small.png" }
  ];

  const OTHERS_LABEL = "Others";
  const OTHERS_COLOR = "#e5e7eb"; 
  const OTHERS_TEXT  = "#6b7280";
  
  const PALETTE = [
      "#6a97db", // Blue (balanced)
      "#e06666", // Red (soft yet bright)
      "#47c290", // Green (fresh)
      "#e9ac48", // Amber (warm)
      "#6d6fe1", // Indigo (mid-tone)
      "#db6bad", // Pink (orchid)
      "#996fdd", // Violet (lavender)
      "#44cbb9", // Teal (aqua)
      "#ec8643", // Orange (sunset)
      "#94cb4f", // Lime (leaf)
      "#4bb4ca", // Cyan (sky)
      "#798797"  // Slate Gray (neutral)
  ];
  const svg = d3.select("#sqProportionalSvg");
  const btns = [...document.querySelectorAll("#raise_years .ybtn")];
  const inp = document.getElementById("raise_inp");
  const pillsEl = document.getElementById("raise_pills");
  const clearBtn = document.getElementById("raise_clear");
  const dd = document.getElementById("raise_dd");

  // --- TOOLTIP SETUP ---
  const tooltip = d3.select(".pictorial-tooltip").empty() 
    ? d3.select("body").append("div").attr("class", "pictorial-tooltip")
    : d3.select(".pictorial-tooltip");

  tooltip
    .style("position", "absolute")
    .style("background", "rgba(15, 23, 42, 0.95)")
    .style("backdrop-filter", "blur(8px)")
    .style("color", "white")
    .style("padding", "8px 12px")
    .style("border-radius", "8px")
    .style("font-family", "'Fira Sans', sans-serif")
    .style("font-size", "12px")
    .style("box-shadow", "0 10px 15px -3px rgba(0, 0, 0, 0.3)")
    .style("pointer-events", "none")
    .style("opacity", 0)
    .style("z-index", 1000)
    .style("border", "1px solid rgba(255,255,255,0.1)");
  
  const colorHoverText = "#f59e0b"; 
  // ---------------------

  const J = s => { try { return JSON.parse(s) } catch { return null } };
  const norm = s => (s || "").trim().replace(/\s+/g, " ");
  const year = r => { const y = +r.publication_year; return Number.isFinite(y) ? y : null };
  const getLogoConfig = name => LOGOS.find(l => l.re.test(name)) || null;

  const insts = r => {
    const c = (r.institutions || "").trim();
    if (c) return c.split(";").map(s => s.trim()).filter(Boolean);
    const o = J(r.raw_json); if (!o?.authorships) return [];
    const out = [];
    for (const a of o.authorships) for (const i of (a?.institutions || [])) if (i?.display_name) out.push(i.display_name.trim());
    return out.filter(Boolean);
  };

  const colorScale = d3.scaleOrdinal(PALETTE);
  const col = s => s === OTHERS_LABEL ? OTHERS_COLOR : colorScale(s);
  
  const getTextColor = (bgColor) => {
    if (bgColor === OTHERS_COLOR) return OTHERS_TEXT;
    const color = d3.color(bgColor);
    const luminance = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
    return luminance > 140 ? "#222" : "#fff";
  };

  const W = () => Math.max(720, Math.min(1200, (svg.node()?.parentElement?.getBoundingClientRect().width || 900)));

  const state = { year: "Total", terms: [] };
  let COUNTS = null, ALL_INST = [];

  const addTerm = t => {
    t = norm(t); if (!t) return;
    if (state.terms.some(x => x.toLowerCase() === t.toLowerCase())) return;
    state.terms.push(t); renderPills(); draw();
  };
  const removeTerm = i => { state.terms.splice(i, 1); renderPills(); draw(); };

  function renderPills() {
    pillsEl.innerHTML = "";
    const container = document.querySelector(".tm_pills_container");

    state.terms.forEach((t, i) => {
      const p = document.createElement("button");
      p.type = "button";
      p.className = "tm_pill"; 
      p.innerHTML = `<span>${t}</span> <span class="close-icon">x</span>`;
      p.onclick = () => removeTerm(i);
      pillsEl.appendChild(p);
    });

    if(state.terms.length) {
        clearBtn.classList.add("visible");
        if (container) container.style.display = "block"; 
    } else {
        clearBtn.classList.remove("visible");
        if (container) container.style.display = "none";
    }
  }

  function setYear(y) {
    state.year = y;
    btns.forEach(b => {
      const on = b.dataset.y === String(y);
      if (on) b.classList.add("active");
      else b.classList.remove("active");
    });
    draw();
  }

  function closeDD() { dd.classList.remove("open"); dd.innerHTML = ""; }
  function openDD(items) {
    dd.innerHTML = "";
    if (!items.length) { closeDD(); return; }
    dd.classList.add("open");
    items.forEach(name => {
      const row = document.createElement("button");
      row.type = "button";
      row.textContent = name;
      row.className = "tm-dd-item"; 
      row.onclick = () => { addTerm(name); inp.value = ""; closeDD(); inp.focus(); };
      dd.appendChild(row);
    });
  }

  function suggestions(q) {
    q = norm(q).toLowerCase();
    if (!q) return [];
    const picked = new Set(state.terms.map(t => t.toLowerCase()));
    const out = [];
    for (const name of ALL_INST) {
      if (out.length >= 15) break;
      const n = name.toLowerCase();
      if (picked.has(n)) continue;
      if (n.includes(q)) out.push(name);
    }
    return out;
  }

  function processDataForProp(itemsMap) {
    let allItems = Array.from(itemsMap.entries()).map(([inst, v]) => ({ inst, v }));
    allItems.sort((a, b) => b.v - a.v);

    const visibleItems = [];
    let othersValue = 0;
    const activeTerms = state.terms.map(t => t.toLowerCase());

    allItems.forEach((item, index) => {
      const name = item.inst;
      const nameL = name.toLowerCase();
      
      const config = getLogoConfig(name);
      const isVip = config && config.isVip;
      const isTop = index < TOP_N_DEFAULT;
      const isSelected = activeTerms.length > 0 && activeTerms.some(t => nameL.includes(t));

      if (isVip || isTop || isSelected) {
        visibleItems.push(item);
      } else {
        othersValue += item.v;
      }
    });

    if (othersValue > 0) {
      const cap = visibleItems.length > 0 ? visibleItems[0].v * 0.5 : othersValue;
      visibleItems.push({ 
        inst: OTHERS_LABEL, 
        v: Math.min(othersValue, cap) 
      });
    }

    return visibleItems;
  }

  function draw() {
    if (!COUNTS) return;

    const y = state.year;
    const w = W();
    const pad = 0;
    const titleH = 30;
    const innerW = w;
    const innerH = Math.max(300, CHART_H - titleH);
    const H = titleH + innerH;

    const t = svg.transition().duration(500).ease(d3.easeCubicOut);
    svg.attr("viewBox", `0 0 ${w} ${H}`).attr("width", w).attr("height", H);
    
    let title = svg.select("text.tm_chart_title");
    if(title.empty()) {
        title = svg.append("text").attr("class", "tm_chart_title")
           .attr("y", 25).attr("text-anchor", "middle");
    }

    let g = svg.select("g.main-group");
    if(g.empty()) {
        g = svg.append("g").attr("class", "main-group");
    }
    g.attr("transform", `translate(${pad},${titleH})`);

    const rawMap = COUNTS.get(y) || new Map();
    const dataItems = processDataForProp(rawMap);
    
    if (!dataItems.length) {
      g.selectAll("*").remove();
      g.append("text").attr("x", innerW / 2).attr("y", innerH / 2)
       .attr("text-anchor", "middle").style("fill", "#666").text("No data available");
      return;
    }

    const root = d3.hierarchy({ children: dataItems })
      .sum(d => d.v)
      .sort((a, b) => {
         if (a.data.inst === OTHERS_LABEL) return 1;
         if (b.data.inst === OTHERS_LABEL) return -1;
         return b.value - a.value;
      });

    d3.treemap()
      .size([innerW, innerH])
      .paddingInner(3)
      .paddingOuter(0)
      .round(true)(root);

    const leaves = root.leaves();

    const nodes = g.selectAll("g.node")
      .data(leaves, d => d.data.inst);

    nodes.exit()
      .transition().duration(300)
      .style("opacity", 0)
      .remove();

    const nodesEnter = nodes.enter().append("g")
      .attr("class", "node")
      .attr("transform", d => `translate(${d.x0},${d.y0})`)
      .style("opacity", 0);

    nodesEnter.append("rect")
      .attr("class", "tm_node_rect")
      .attr("rx", 6).attr("ry", 6)
      .attr("width", d => Math.max(0, d.x1 - d.x0))
      .attr("height", d => Math.max(0, d.y1 - d.y0));

    nodesEnter.append("image")
      .style("pointer-events", "none")
      .attr("preserveAspectRatio", "xMidYMid meet");

    nodesEnter.append("text")
      .attr("class", "tm_label_main");
      
    nodesEnter.append("text")
       .attr("class", "tm_label_sub");

    const nodesMerge = nodesEnter.merge(nodes);

    // --- UPDATED TOOLTIP LOGIC ---
    nodesMerge
      .on("mousemove", function(event, d) {
          // Calculate current width and height
          const width = d.x1 - d.x0;
          const height = d.y1 - d.y0;

          // Only show tooltip if text is HIDDEN (height < 35 OR width < 50)
          if (height < 35 || width < 50) {
              tooltip.transition().duration(100).style("opacity", 1);
              tooltip
                .html(`
                    <div style="font-weight:600; color:${colorHoverText}">${d.data.inst}</div>
                    <div style="margin-top:2px;">${d.value} publications</div>
                `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px");
          } else {
              // Otherwise, ensure it is hidden
              tooltip.style("opacity", 0);
          }
      })
      .on("mouseleave", function() {
          tooltip.transition().duration(200).style("opacity", 0);
      });
    // -----------------------------

    nodesMerge.transition(t)
      .attr("transform", d => `translate(${d.x0},${d.y0})`)
      .style("opacity", 1);

    nodesMerge.select("rect")
      .transition(t)
      .attr("width", d => Math.max(0, d.x1 - d.x0))
      .attr("height", d => Math.max(0, d.y1 - d.y0))
      .attr("fill", d => col(d.data.inst));

    nodesMerge.select("image")
      .each(function(d) {
        const img = d3.select(this);
        const lg = getLogoConfig(d.data.inst);
        if (d.data.inst === OTHERS_LABEL || !lg) { img.attr("display", "none"); return; }
        
        const w = d.x1 - d.x0, h = d.y1 - d.y0;
        const s = Math.min(w, h) * 0.55;
        if (s < 20) { img.attr("display", "none"); return; }

        img.attr("display", "block")
           .attr("href", lg.url)
           .attr("x", (w - s) / 2)
           .attr("y", (h - s) / 2)
           .attr("width", s)
           .attr("height", s);
      });

    nodesMerge.select("text.tm_label_main")
      .each(function(d) {
        const txt = d3.select(this);
        const w = d.x1 - d.x0, h = d.y1 - d.y0;
        
        // Hide if too small (Tooltip handles this case now)
        if (h < 35 || w < 50) { txt.attr("display", "none"); return; } 
        txt.attr("display", "block");

        const bgColor = col(d.data.inst);
        const textColor = getTextColor(bgColor);

        txt.text(null).attr("x", 6).attr("y", 18).style("fill", textColor);

        const words = d.data.inst.split(/\s+/).reverse();
        let word, line = [];
        let lineNumber = 0;
        const lineHeight = 1.1; 
        const width = w - 12;
        
        let tspan = txt.append("tspan").attr("x", 6).attr("y", 18).attr("dy", 0);

        while (word = words.pop()) {
          line.push(word);
          tspan.text(line.join(" "));
          if (tspan.node().getComputedTextLength() > width && line.length > 1) {
            line.pop();
            tspan.text(line.join(" "));
            line = [word];
            if ((lineNumber + 1) * 14 > h - 30) { break; } 
            tspan = txt.append("tspan")
                        .attr("x", 6)
                        .attr("y", 18)
                        .attr("dy", ++lineNumber * lineHeight + "em")
                        .text(word);
          }
        }
      });
      
    nodesMerge.select("text.tm_label_sub")
      .each(function(d) {
        const txt = d3.select(this);
        const w = d.x1 - d.x0, h = d.y1 - d.y0;
        if (h < 50 || w < 50) { txt.attr("display", "none"); return; }
        
        const bgColor = col(d.data.inst);
        const textColor = getTextColor(bgColor);
        
        txt.attr("display", "block")
           .attr("x", 6)
           .attr("y", h - 8) 
           .style("fill", textColor)
           .text(d.value + " pubs");
      });
  }

  d3.csv(CSV).then(rows => {
    COUNTS = new Map([...YEARS, "Total"].map(y => [y, new Map()]));
    const setAll = new Set();

    for (const r of rows) {
      const y = year(r); if (!YEARS.includes(y)) continue;
      
      const mYear = COUNTS.get(y);
      const mTotal = COUNTS.get("Total");
      
      const set = new Set(insts(r));
      for (const s of set) { 
          mYear.set(s, (mYear.get(s) || 0) + 1);
          mTotal.set(s, (mTotal.get(s) || 0) + 1);
          setAll.add(s); 
      }
    }

    ALL_INST = [...setAll].sort((a, b) => a.localeCompare(b));

    btns.forEach(b => b.onclick = () => {
        const val = b.dataset.y === "Total" ? "Total" : +b.dataset.y;
        setYear(val);
    });

    setYear("Total");
    renderPills();

    inp.addEventListener("input", () => openDD(suggestions(inp.value)));
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const items = suggestions(inp.value);
        if (items.length) { addTerm(items[0]); inp.value = ""; closeDD(); }
      } else if (e.key === "Escape") {
        closeDD();
      } else if (e.key === "Backspace" && !inp.value && state.terms.length) {
        state.terms.pop(); renderPills(); draw();
      }
    });

    inp.addEventListener("blur", () => setTimeout(closeDD, 200));
    clearBtn.onclick = () => { state.terms = []; renderPills(); draw(); closeDD(); };

    let to;
    window.addEventListener("resize", () => {
      clearTimeout(to); to = setTimeout(draw, 200);
    }, { passive: true });
  });
})();