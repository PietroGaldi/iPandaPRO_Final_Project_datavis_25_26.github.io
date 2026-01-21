(() => {
  const CONFIG = {
    csvUrl: "data/openalex_works_full.csv",
    geoJsonUrl: "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson",
    width: 1600,
    height: 820,
    pad: 20,
    colors: d3.schemeBlues[9],
    unknownColor: "#f3f4f6",
    strokeColor: "#ffffff",
    highlightStroke: "#111827"
  };

  const svg = d3.select("#chl_svg")
    .attr("viewBox", `0 0 ${CONFIG.width} ${CONFIG.height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const gBg = svg.append("rect")
    .attr("width", CONFIG.width)
    .attr("height", CONFIG.height)
    .attr("fill", "transparent")
    .on("click", clearPin);

  const gRoot = svg.append("g");
  const gMap = gRoot.append("g");
  const gOverlay = gRoot.append("g");

  const main = d3.select("#chl_main");
  const tip = d3.select("#chl_tip");
  const legend = d3.select("#chl_legend");
  const panel = d3.select("#chl_panel");
  const panelBody = d3.select("#chl_panel_body");
  const searchInput = d3.select("#chl_search");
  const resetBtn = d3.select("#chl_reset");

  const norm = s => (s || "").trim();
  const normUp = s => norm(s).toUpperCase();
  const safeJSON = s => { try { return JSON.parse(s); } catch { return null; } };

  function hidePanel() {
    panel.style("display", "none");
    main.style("grid-template-columns", "1fr");
  }

  function showPanel() {
    main.style("grid-template-columns", "4fr 1fr");
    panel
      .style("display", "block")
      .style("border", "1px solid #e5e7eb")
      .style("border-radius", "14px")
      .style("background", "#fff")
      .style("padding", "12px")
      .style("min-height", "140px")
      .style("width", "13rem");
  }

  function iso2FromProps(p) {
    if (!p) return null;
    let code = p.ISO_A2 || p.ISO2 || p.iso2 || p.iso_a2 || p.A2 || p["ISO3166-1-Alpha-2"];
    if (code && code !== "-99" && code !== -99) return normUp(code);

    const name = (p.ADMIN || p.NAME || p.name || "").toLowerCase();
    if (name === "france") return "FR";
    if (name === "norway") return "NO";
    return null;
  }

  function nameFromProps(p) {
    if (!p) return "Unknown";
    // Prioritize human-readable names. Added lowercase 'name' and 'admin' just in case.
    return norm(p.ADMIN || p.NAME || p.name || p.admin || p.NAME_EN || p.BRK_NAME || "Region");
  }

  // DATA PROCESSING
  async function buildCountryData() {
    const rows = await d3.csv(CONFIG.csvUrl);

    const instIdsByCC = new Map();
    const instNamesByCC = new Map();
    let parsedCount = 0;

    for (const r of rows) {
      const obj = safeJSON(r.raw_json);
      if (!obj || !obj.authorships) continue;
      parsedCount++;

      for (const a of obj.authorships) {
        if (!a.institutions) continue;

        for (const inst of a.institutions) {
          const cc = normUp(inst.country_code);
          if (!cc) continue;

          const iid = norm(inst.id || inst.ror || inst.display_name);
          if (!iid) continue;

          if (!instIdsByCC.has(cc)) instIdsByCC.set(cc, new Set());
          instIdsByCC.get(cc).add(iid);

          const dn = norm(inst.display_name);
          if (dn) {
            if (!instNamesByCC.has(cc)) instNamesByCC.set(cc, new Map());
            const m = instNamesByCC.get(cc);
            m.set(dn, (m.get(dn) || 0) + 1);
          }
        }
      }
    }

    const counts = new Map();
    for (const [cc, set] of instIdsByCC.entries()) counts.set(cc, set.size);

    console.log(`[Choropleth] Parsed ${parsedCount} rows. Found ${counts.size} countries.`);
    return { counts, instNamesByCC };
  }

  function makeDiscreteScale(values) {
    const v = values.filter(x => x > 0).sort((a, b) => a - b);
    const maxV = v.length ? v[v.length - 1] : 1;
    const minV = v.length ? v[0] : 1;

    if (v.length === 0) {
      return { scale: _ => CONFIG.unknownColor, thresholds: [], colors: [], maxV: 0 };
    }

    const START_IDX = 3;
    const colors = CONFIG.colors.slice(START_IDX);

    const logScale = d3.scaleLog()
      .domain([minV, maxV])
      .range([0, colors.length]);

    let thresholds = [];
    for (let i = 1; i < colors.length; i++) {
      const val = Math.round(logScale.invert(i));
      if (!thresholds.includes(val) && val < maxV) thresholds.push(val);
    }
    thresholds.sort((a, b) => a - b);

    const usedColors = colors.slice(0, thresholds.length + 1);

    const scale = d3.scaleThreshold()
      .domain(thresholds)
      .range(usedColors);

    return { scale, thresholds, colors: usedColors, maxV };
  }

  // LEGEND
  function drawLegend(scale, thresholds, colors, maxV) {
    legend.selectAll("*").remove();

    const width = 220;
    const height = 40;
    const barHeight = 8;
    const mt = 15;

    const lsvg = legend.append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("width", "100%")
      .style("height", "auto")
      .style("display", "block");

    const n = colors.length;
    const segW = (width - 10) / n;

    const g = lsvg.append("g");

    g.append("text")
      .attr("x", 0)
      .attr("y", 9)
      .text("Distinct Institutions")
      .attr("fill", "#555")
      .style("font-size", "10px")
      .style("font-weight", "600")
      .style("font-family", "system-ui, sans-serif");

    colors.forEach((c, i) => {
      g.append("rect")
        .attr("x", i * segW)
        .attr("y", mt)
        .attr("width", segW)
        .attr("height", barHeight)
        .attr("fill", c)
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5);
    });

    g.append("text")
      .attr("x", 0)
      .attr("y", mt + barHeight + 10)
      .text("0")
      .attr("text-anchor", "start")
      .style("font-size", "8px")
      .attr("fill", "#555");

    thresholds.forEach((t, i) => {
      if (i < n - 1) {
        g.append("text")
          .attr("x", (i + 1) * segW)
          .attr("y", mt + barHeight + 10)
          .text(t)
          .attr("text-anchor", "middle")
          .style("font-size", "8px")
          .attr("fill", "#555");
      }
    });

    g.append("text")
      .attr("x", n * segW)
      .attr("y", mt + barHeight + 10)
      .text(maxV)
      .attr("text-anchor", "end")
      .style("font-size", "8px")
      .attr("fill", "#555");
  }

  // TOOLTIP
  function showTip(html, evt) {
    const box = svg.node().getBoundingClientRect();
    let x = evt.clientX - box.left + 15;
    let y = evt.clientY - box.top + 15;

    if (x > box.width - 200) x -= 220;
    if (y > box.height - 100) y -= 120;

    tip.html(html)
      .style("left", `${x}px`)
      .style("top", `${y}px`)
      .style("opacity", 1)
      .style("padding", "8px 12px")
      .style("background", "rgba(255, 255, 255, 0.95)")
      .style("backdrop-filter", "blur(4px)")
      .style("border", "1px solid #e5e7eb")
      .style("box-shadow", "0 4px 6px -1px rgba(0, 0, 0, 0.1)")
      .style("border-radius", "6px")
      .style("pointer-events", "none");
  }
  function hideTip() { tip.style("opacity", 0); }

  // PANEL
  // PANEL
  function updatePanel(name, iso2, count, instEntriesSorted) {
    if (!iso2) {
      hidePanel();
      panelBody.html("");
      return;
    }

    showPanel();

    const listHtml = instEntriesSorted.length
      ? instEntriesSorted.map(([n, c], i) =>
        `<div style="display:flex; justify-content:space-between; gap:8px; padding:4px 0; border-bottom:1px solid #f3f4f6; font-size:12px;">
           <span style="font-weight:500; color:#374151; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${n}">${i + 1}. ${n}</span>
           <span style="color:#6b7280; flex:0 0 auto;">${c}</span>
         </div>`
      ).join("")
      : `<div style="color:#999">No data available</div>`;

    panelBody.html(`
      <div style="border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 10px;">
        <h3 style="margin:0; font-size:18px; color:#111827;">${name}</h3>
      </div>

      <div style="margin-bottom:10px;">
        <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; margin-bottom:4px;">Total Distinct Institutions</div>
        <div style="font-size:24px; font-weight:700; color:#2563eb;">${count}</div>
      </div>

      <div>
        <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; margin-bottom:8px;">
          Institutions by publication count (${instEntriesSorted.length})
        </div>

        <div class="modern-scroll" style="
          max-height: 18.2rem;
          overflow-y: auto;
          padding-right: 0.7rem;
        ">
          ${listHtml}
        </div>
      </div>
    `);
  }

  // STATE
  let pinnedCC = null;
  let zoomBehavior = null;

  function clearPin() {
    pinnedCC = null;
    gOverlay.selectAll("*").remove();
    hidePanel();
    panelBody.html("");
    gMap.selectAll("path").attr("opacity", 1);
  }

  // MAIN RENDER
  async function render() {

    try {
      const [{ counts, instNamesByCC }, geo] = await Promise.all([
        buildCountryData(),
        d3.json(CONFIG.geoJsonUrl)
      ]);

      geo.features = geo.features.filter(f => iso2FromProps(f.properties) !== "AQ");

      const focusGeo = {
        type: "FeatureCollection",
        features: geo.features.filter(f => {
          const center = d3.geoCentroid(f);
          return center[1] > -10;
        })
      };

      const values = [...counts.values()];
      const { scale, thresholds, colors, maxV } = makeDiscreteScale(values);
      drawLegend(scale, thresholds, colors, maxV);

      const projection = d3.geoNaturalEarth1()
        .fitExtent([[CONFIG.pad, CONFIG.pad], [CONFIG.width - CONFIG.pad, CONFIG.height - CONFIG.pad]], focusGeo);

      const pathGenerator = d3.geoPath(projection);

      zoomBehavior = d3.zoom()
        .scaleExtent([1, 8])
        .translateExtent([[0, 0], [CONFIG.width, CONFIG.height * 2.5]])
        .on("zoom", (e) => gRoot.attr("transform", e.transform));

      svg.call(zoomBehavior);

      const paths = gMap.selectAll("path")
        .data(geo.features)
        .join("path")
        .attr("d", pathGenerator)
        .attr("fill", d => {
          const cc = iso2FromProps(d.properties);
          const v = counts.get(cc) || 0;
          return v > 0 ? scale(v) : CONFIG.unknownColor;
        })
        .attr("stroke", CONFIG.strokeColor)
        .attr("stroke-width", 0.5)
        .style("cursor", "pointer")
        .style("transition", "fill 0.2s ease");

      paths
        .on("mouseenter", function () {
          if (pinnedCC) return;
          d3.select(this).attr("stroke", "#666").attr("stroke-width", 1).raise();
        })
        .on("mousemove", (evt, d) => {
          if (pinnedCC) return;
          const cc = iso2FromProps(d.properties);
          const name = nameFromProps(d.properties); // Get the full name
          const v = counts.get(cc) || 0;

          // CHANGED: Display 'name' in the tooltip title instead of 'cc'
          showTip(`
    <div style="font-weight:700; color:#1f2937;">${name || "—"}</div>
    <div style="font-size:12px; color:#4b5563;">Institutions: <b>${v}</b></div>
    `, evt);
        })
        .on("mouseleave", function () {
          if (pinnedCC) return;
          d3.select(this).attr("stroke", CONFIG.strokeColor).attr("stroke-width", 0.5);
          hideTip();
        })
        .on("click", (evt, d) => {
          evt.stopPropagation();
          hideTip();

          const cc = iso2FromProps(d.properties);
          const name = nameFromProps(d.properties);
          const v = counts.get(cc) || 0;

          if (pinnedCC === cc) {
            clearPin();
            return;
          }

          pinnedCC = cc;

          gOverlay.selectAll("*").remove();
          gOverlay.append("path")
            .attr("d", pathGenerator(d))
            .attr("fill", "none")
            .attr("stroke", CONFIG.highlightStroke)
            .attr("stroke-width", 2)
            .attr("pointer-events", "none");

          const instEntriesSorted = instNamesByCC.has(cc)
            ? [...instNamesByCC.get(cc).entries()].sort((a, b) => b[1] - a[1])
            : [];

          updatePanel(name, cc, v, instEntriesSorted);
        });

      const handleSearch = (query) => {
        const q = normUp(query);
        if (!q) { paths.attr("opacity", 1); return; }

        paths.attr("opacity", d => {
          const n = nameFromProps(d.properties).toUpperCase();
          return n.includes(q) ? 1 : 0.1;
        });

        const match = geo.features.find(f => nameFromProps(f.properties).toUpperCase().includes(q));
        if (match) {
          const [[x0, y0], [x1, y1]] = pathGenerator.bounds(match);
          const dx = x1 - x0, dy = y1 - y0;
          const x = (x0 + x1) / 2, y = (y0 + y1) / 2;
          const s = Math.max(1, Math.min(8, 0.9 / Math.max(dx / CONFIG.width, dy / CONFIG.height)));

          // Centro dello schermo
          const t = [CONFIG.width / 2 - s * x, CONFIG.height / 2 - s * y];

          svg.transition().duration(750).call(
            zoomBehavior.transform,
            d3.zoomIdentity.translate(t[0], t[1]).scale(s)
          );
        }
      };

      searchInput.on("input", function () {
        const q = this.value;
        if (!q) { paths.attr("opacity", 1); return; }
        const qq = normUp(q);
        paths.attr("opacity", d => nameFromProps(d.properties).toUpperCase().includes(qq) ? 1 : 0.1);
      });

      searchInput.on("keydown", function (e) {
        if (e.key === "Enter") handleSearch(this.value);
      });

      resetBtn.on("click", () => {
        searchInput.property("value", "");
        paths.attr("opacity", 1);
        clearPin();
        svg.transition().duration(750).call(zoomBehavior.transform, d3.zoomIdentity);
      });

      hidePanel();
      panelBody.html("");

    } catch (err) {
      console.error(err);
      legend.html(`<div style="color:red; font-size:12px;">Error: ${err.message}</div>`);
    } 
  }

  render();
})();