(() => {
  const W = 1100, H = 650,
    WORKS = "data/openalex_works_full.csv",
    PEOPLE = "data/openalex_people.csv";

  const svg = d3.select("#netSvg").attr("width", W).attr("height", H).style("background", "#fff");
  const tip = d3.select("#tip"), meta = d3.select("#meta"), inp = d3.select("#authorSearch");

  // layers of links, nodes, labels
  const g = svg.append("g"),
    LG = g.append("g"),
    NG = g.append("g"),
    TG = g.append("g");

  // zoom
  const zoom = d3.zoom().scaleExtent([.22, 6]).on("zoom", e => g.attr("transform", e.transform));
  svg.call(zoom);

  // helpers
  const J = s => { try { return JSON.parse(s); } catch { return null; } };
  const norm = id => { // normalize OpenAlex author ids to full URL (stable keys)
    id = ("" + (id || "")).trim();
    if (!id) return "";
    if (id.startsWith("http")) return id;
    if (/^[A-Za-z]\d+$/.test(id)) return `https://openalex.org/${id}`;
    return (id.includes("openalex.org/") && !id.startsWith("http")) ? `https://${id}` : id;
  };
  const esc = s => ("" + (s || ""))
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  // tooltip handlers
  const tipShow = (e, html) => tip.style("opacity", 1).html(html)
    .style("left", (e.pageX + 10) + "px").style("top", (e.pageY + 10) + "px");
  const tipMove = e => tip.style("left", (e.pageX + 10) + "px").style("top", (e.pageY + 10) + "px");
  const tipHide = () => tip.style("opacity", 0);

  // state variables
  let sim = null,
    linksAll = [],
    nb = new Map(),
    nameById = new Map(),
    idByName = new Map();
  const clear = () => { LG.selectAll("*").remove(); NG.selectAll("*").remove(); TG.selectAll("*").remove(); };
  const zoomOut = () => svg.call(zoom.transform, d3.zoomIdentity.translate(W / 2, H / 2).scale(.22).translate(-W / 2, -H / 2));

  // LOAD DATA AND PREPROCESS
  Promise.all([d3.csv(WORKS), d3.csv(PEOPLE)]).then(([works, people]) => {
    // id -> display name
    nameById = new Map(
      people
        .map(r => [norm(r.openalexid || r.openalex_id || r.id), (r.display_name || r.name || r.alias || "").trim()])
        .filter(d => d[0] && d[1])
    );

    // pair aggregation: "a|b" -> {count, titles:Set}
    const pair = new Map();
    works.forEach(r => {
      const w = J(r.raw_json); if (!w?.authorships) return;
      const title = (w.title || r.title || "").trim();
      const ids = [...new Set(w.authorships.map(a => norm(a?.author?.id)).filter(Boolean))].sort();
      // fill nameById map for authors not in people file
      w.authorships.forEach(a => {
        const id = norm(a?.author?.id), nm = a?.author?.display_name;
        if (id && nm && !nameById.has(id)) nameById.set(id, nm);
      });
      // all unique pairs of co-authors in this work
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        const k = `${ids[i]}|${ids[j]}`;
        const obj = pair.get(k) || { count: 0, titles: new Set() };
        obj.count += 1;
        if (title) obj.titles.add(title);
        pair.set(k, obj);
      }
    });

    // final links array
    linksAll = [...pair].map(([k, obj]) => {
      const [s, t] = k.split("|");
      return { source: s, target: t, value: obj.count, titles: [...obj.titles] };
    });

    // neighbor map for ego network
    nb = new Map();
    const add = (a, b) => (nb.get(a) || nb.set(a, new Set()).get(a)).add(b);
    linksAll.forEach(l => { add(l.source, l.target); add(l.target, l.source); });

    // name -> id map for search box
    // 1. Build the map
    idByName = new Map();
    [...nameById].sort((a, b) => d3.ascending(a[1], b[1]))
      .forEach(([id, nm]) => { if (!idByName.has(nm)) idByName.set(nm, id); });

    // 2. Custom Dropdown Logic
    const dd = d3.select("#netDropdown");
    const allNames = [...idByName.keys()]; // Store all names array

    inp.on("input", function () {
      const val = (this.value || "").toLowerCase().trim();

      // Clear dropdown if empty
      if (!val) {
        dd.classed("open", false).html("");
        return;
      }

      // Filter names (Limit to top 50 to keep it fast)
      const matches = allNames.filter(n => n.toLowerCase().includes(val)).slice(0, 50);

      if (matches.length === 0) {
        dd.classed("open", false);
      } else {
        dd.classed("open", true);

        // Render items
        dd.selectAll(".net-dd-item")
          .data(matches)
          .join("div")
          .attr("class", "net-dd-item")
          .text(d => d)
          .on("click", (e, d) => {
            e.stopPropagation();
            inp.property("value", d); // Set input value
            dd.classed("open", false); // Hide dropdown
            const id = idByName.get(d);
            if (id) draw(id); // Trigger graph
          });
      }
    });

    // Close dropdown if clicking outside
    d3.select("body").on("click", () => dd.classed("open", false));
    d3.select("#resetBtn").on("click", () => {
      inp.property("value", "");
      draw(null);
    });
    svg.on("click", tipHide);
    draw(null);
  }).catch(err => { console.error(err); meta.text("Error: check console."); });

  // main draw function
  function draw(center) {
    tipHide();
    if (sim) sim.stop();
    clear();

    const ego = !!center;

    // build nodes and links based on ego or full view
    let nodes, links;
    if (!ego) {
      const ids = new Set(); linksAll.forEach(l => { ids.add(l.source); ids.add(l.target); });
      nodes = [...ids].map(id => ({ id, name: nameById.get(id) || id }));
      links = linksAll.map(d => ({ ...d }));
      meta.text(`All authors - nodes ${nodes.length} - links ${links.length}`);
      zoomOut();
    } else {
      const keep = new Set([center, ...(nb.get(center) || [])]);
      nodes = [...keep].map(id => ({ id, name: nameById.get(id) || id }));
      links = linksAll.filter(l => l.source === center || l.target === center).map(d => ({ ...d }));
      meta.text(`Showing: ${nameById.get(center) || center} - links ${links.length}`);
      svg.transition().duration(200).call(zoom.transform, d3.zoomIdentity);
    }

    const maxV = d3.max(links, d => d.value) || 1;
    const w = d3.scaleSqrt().domain([1, maxV]).range([1, 6]);

    // draw links
    const link = LG.selectAll("line").data(links).join("line")
      .attr("stroke", "#94a3b8")
      .attr("stroke-opacity", ego ? .85 : .55)
      .attr("stroke-width", d => w(d.value))
      .attr("stroke-linecap", "round");

    // ego view: link tooltips with titles
    if (ego) {
      link.style("cursor", "help")
        .on("click", (e, d) => {
          e.stopPropagation();

          const sid = typeof d.source === "object" ? d.source.id : d.source;
          const tid = typeof d.target === "object" ? d.target.id : d.target;
          const sName = nameById.get(sid) || sid;
          const tName = nameById.get(tid) || tid;

          const uniq = [...new Set(d.titles || [])].filter(Boolean);
          const max = 10;
          const shown = uniq.slice(0, max);
          const more = uniq.length > max ? uniq.length - max : 0;

          const html =
            `<div style="max-width:340px; font-size:12px; line-height:1.25">
               <b>${esc(sName)} <span style="opacity:.7">&harr;</span> ${esc(tName)}</b><br>
               ${shown.length ? shown.map(t => `- ${esc(t)}`).join("<br>") : "<i>No titles available</i>"}
               ${more ? `<div style="margin-top:6px; opacity:.75">+${more} more</div>` : ""}
             </div>`;

          tipShow(e, html);
        })
        .on("pointerleave", tipHide);
    }

    // draw nodes
    const node = NG.selectAll("circle").data(nodes, d => d.id).join("circle")
      .attr("r", d => d.id === center ? 10 : (ego ? 6 : 4))
      .attr("fill", d => d.id === center ? "#f59e0b" : "#64748b")
      .attr("stroke", "#fff").attr("stroke-width", 1.2)
      .style("cursor", "pointer")
      .on("pointerenter", (e, d) => tipShow(e, `<b>${esc(d.name)}</b>`))
      .on("pointermove", tipMove)
      .on("pointerleave", tipHide)
      .on("click", (e, d) => {
        e.stopPropagation();
        inp.property("value", nameById.get(d.id) || "");
        draw(d.id);
      });

    // ego labels
    let labels = null;
    if (ego) {
      labels = TG.selectAll("text")
        .data(nodes.filter(d => d.id !== center), d => d.id)
        .join("text")
        .text(d => d.name)
        .attr("font-size", 9)
        .attr("fill", "#334155")
        .attr("pointer-events", "none");
    }

    sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(ego ? 90 : 45))
      .force("charge", d3.forceManyBody().strength(ego ? -350 : -30))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("collide", d3.forceCollide(ego ? 16 : 6))
      .on("tick", () => {
        link
          .attr("x1", d => d.source.x).attr("y1", d => d.source.y)
          .attr("x2", d => d.target.x).attr("y2", d => d.target.y);

        node.attr("cx", d => d.x).attr("cy", d => d.y);

        if (ego && labels) {
          const c = nodes.find(n => n.id === center);
          if (c) {
            labels
              .attr("x", d => {
                const dx = d.x - c.x, dy = d.y - c.y;
                const len = Math.hypot(dx, dy) || 1;
                return d.x + (dx / len) * 10;
              })
              .attr("y", d => {
                const dx = d.x - c.x, dy = d.y - c.y;
                const len = Math.hypot(dx, dy) || 1;
                return d.y + (dy / len) * 10 + 3;
              })
              .attr("text-anchor", d => (d.x - c.x) >= 0 ? "start" : "end");
          }
        }
      });
  }
})();