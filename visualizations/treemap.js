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
    "#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f",
    "#edc949", "#af7aa1", "#ff9da7", "#9c755f", "#bab0ab",
    "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd"
  ];

  const svg = d3.select("#sqTreemapSvg");
  const btns = [...document.querySelectorAll("#raise_years .ybtn")];
  const inp = document.getElementById("raise_inp");
  const pillsEl = document.getElementById("raise_pills");
  const clearBtn = document.getElementById("raise_clear");
  const dd = document.getElementById("raise_dd");

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

  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 };
  const col = s => s === OTHERS_LABEL ? OTHERS_COLOR : PALETTE[hash(s) % PALETTE.length];
  
  const getTextColor = (bgColor) => {
    if (bgColor === OTHERS_COLOR) return OTHERS_TEXT;
    const color = d3.color(bgColor);
    const luminance = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
    return luminance > 140 ? "#222" : "#fff";
  };

  const W = () => Math.max(720, Math.min(1200, (svg.node()?.parentElement?.getBoundingClientRect().width || 900)));

  // Imposta Total come default
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
    state.terms.forEach((t, i) => {
      const p = document.createElement("button");
      p.type = "button";
      p.className = "raise-pill"; 
      p.innerHTML = `<span>${t}</span> <span class="close-icon">×</span>`;
      p.onclick = () => removeTerm(i);
      pillsEl.appendChild(p);
    });
    if(state.terms.length) clearBtn.classList.add("visible");
    else clearBtn.classList.remove("visible");
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
      row.className = "raise-dd-item"; 
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

  function processDataForTreemap(itemsMap) {
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
    
    let title = svg.select("text.chart-title");
    if(title.empty()) {
        title = svg.append("text").attr("class", "chart-title")
           .attr("y", 18).attr("text-anchor", "middle");
    }
    title.attr("x", w / 2).text(`Institutional Output ${y}`);

    let g = svg.select("g.main-group");
    if(g.empty()) {
        g = svg.append("g").attr("class", "main-group");
    }
    g.attr("transform", `translate(${pad},${titleH})`);

    const rawMap = COUNTS.get(y) || new Map();
    const dataItems = processDataForTreemap(rawMap);
    
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
      .attr("rx", 6).attr("ry", 6)
      .attr("width", d => Math.max(0, d.x1 - d.x0))
      .attr("height", d => Math.max(0, d.y1 - d.y0));

    nodesEnter.append("image")
      .style("pointer-events", "none")
      .attr("preserveAspectRatio", "xMidYMid meet");

    nodesEnter.append("text")
      .attr("class", "label-main");
      
    nodesEnter.append("text")
       .attr("class", "label-sub");

    const nodesMerge = nodesEnter.merge(nodes);

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

    nodesMerge.select("text.label-main")
      .each(function(d) {
        const txt = d3.select(this);
        const w = d.x1 - d.x0, h = d.y1 - d.y0;
        
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
      
    nodesMerge.select("text.label-sub")
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
          // Aggiungi all'anno specifico
          mYear.set(s, (mYear.get(s) || 0) + 1);
          // Aggiungi al Totale
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