(() => {
    const W = 1100, H = 650,
        WORKS = "data/openalex_works_full.csv",
        PEOPLE = "data/openalex_people.csv";

    const svg = d3.select("#netSvg").attr("width", W).attr("height", H).style("background", "#fff");
    const tip = d3.select("#tip"), meta = d3.select("#meta"), inp = d3.select("#authorSearch");

    // institution selection elements
    const instInp = d3.select("#instSearch");
    const instDD = d3.select("#instDropdown");

    let instChips = d3.select("#instChips");
    if (instChips.empty()) instChips = d3.select(".net-controls").append("div").attr("id", "instChips").attr("class", "inst-chips");

    let instClear = d3.select("#instClear");
    if (instClear.empty()) instClear = d3.select("#instBox").append("button").attr("id", "instClear").attr("type", "button").text("Clear");

    // layers of links, nodes, labels
    const g = svg.append("g"),
        LG = g.append("g"),
        NG = g.append("g"),
        TG = g.append("g");

    // zoom
    const zoom = d3.zoom().scaleExtent([0.1, 12]).on("zoom", e => g.attr("transform", e.transform));
    svg.call(zoom);

    // helpers
    const J = s => { try { return JSON.parse(s); } catch { return null; } };
    const norm = id => {
        id = ("" + (id || "")).trim();
        if (!id) return "";
        if (id.startsWith("http")) return id;
        if (/^[A-Za-z]\d+$/.test(id)) return `https://openalex.org/${id}`;
        return (id.includes("openalex.org/") && !id.startsWith("http")) ? `https://${id}` : id;
    };
    const esc = s => ("" + (s || ""))
        .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;").replaceAll("'", "&quot;")
        .replaceAll("'", "&#039;");

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

    // institutions state
    let instByAuthor = new Map();
    let selectedInst = new Set();

    const INST_FIXED_COLORS = new Map([
        ["unige", "#2563eb"],
        ["iit", "#ea6f4d"],
        ["cnr", "#fab115"]
    ]);

    const instColor = d3.scaleOrdinal(d3.schemeSet1);
    const colorForInst = (inst) => {
        const k = (inst || "").toLowerCase();
        if (/university of genoa/.test(k)) return INST_FIXED_COLORS.get("unige");
        if (/italian institute of technology/.test(k)) return INST_FIXED_COLORS.get("iit");
        if (/national research council/.test(k)) return INST_FIXED_COLORS.get("cnr");
        return instColor(inst);
    };

    let currentCenter = null;

    const clear = () => { LG.selectAll("*").remove(); NG.selectAll("*").remove(); TG.selectAll("*").remove(); };
    const zoomOut = () => svg.call(
        zoom.transform,
        d3.zoomIdentity.translate(W / 2, H / 2).scale(0.35).translate(-W / 2, -H / 2)
    );

    const matchedInst = (authorId) => {
        if (!selectedInst.size) return [];
        const s = instByAuthor.get(authorId);
        if (!s) return [];
        const out = [];
        for (const inst of selectedInst) if (s.has(inst)) out.push(inst);
        return out;
    };

    function renderChips() {
        const arr = [...selectedInst].sort(d3.ascending);

        const chip = instChips.selectAll("span.inst-chip")
            .data(arr, d => d)
            .join(enter => {
                const s = enter.append("span").attr("class", "inst-chip");
                s.append("span")
                    .attr("class", "dot")
                    .style("width", "10px")
                    .style("height", "10px")
                    .style("border-radius", "999px")
                    .style("display", "inline-block")
                    .style("background", d => colorForInst(d));
                s.append("span").attr("class", "t").text(d => d);
                s.append("span")
                    .attr("class", "x")
                    .html("&times;")
                    .on("click", (e, d) => {
                        e.stopPropagation();
                        selectedInst.delete(d);
                        renderChips();
                        draw(currentCenter);
                    });
                return s;
            });

        chip.select(".dot").style("background", d => colorForInst(d));
        chip.select(".t").text(d => d);

        if (!instClear.empty()) instClear.style("display", selectedInst.size ? "inline-flex" : "none");
    }

    // LOAD DATA AND PREPROCESS
    Promise.all([d3.csv(WORKS), d3.csv(PEOPLE)]).then(([works, people]) => {
        // id -> display name
        nameById = new Map(
            people
                .map(r => [norm(r.openalex_id || r.openalexid || r.id),
                (r.display_name || r.name || r.alias || "").trim()])
                .filter(d => d[0] && d[1])
        );

        // build institutions
        const allInst = new Set();
        instByAuthor = new Map();

        const addInst = (aid, instName) => {
            instName = (instName || "").trim();
            if (!aid || !instName) return;
            let s = instByAuthor.get(aid);
            if (!s) instByAuthor.set(aid, (s = new Set()));
            s.add(instName);
            allInst.add(instName);
        };

        people.forEach(r => {
            const aid = norm(r.openalex_id || r.openalexid || r.id);
            if (!aid) return;
            const insts = (r.institutions || "").split(";").map(x => x.trim()).filter(Boolean);
            insts.forEach(n => addInst(aid, n));
        });

        const instList = [...allInst].sort(d3.ascending);

        // --- Institution search dropdown (like Author) ---
        instInp.on("input", function () {
            const val = (this.value || "").toLowerCase().trim();

            if (!val) { instDD.classed("open", false).html(""); return; }

            const matches = instList
                .filter(n => n.toLowerCase().includes(val))
                .slice(0, 50);

            if (matches.length === 0) {
                instDD.classed("open", false).html("");
            } else {
                instDD.classed("open", true);

                instDD.selectAll(".net-dd-item")
                    .data(matches, d => d)
                    .join("div")
                    .attr("class", "net-dd-item")
                    .text(d => d)
                    .on("click", (e, d) => {
                        e.stopPropagation();
                        selectedInst.add(d);
                        instInp.property("value", "");
                        instDD.classed("open", false).html("");
                        renderChips();
                        draw(currentCenter);
                    });
            }
        });

        // clear button
        if (!instClear.empty()) {
            instClear.on("click", () => {
                selectedInst.clear();
                renderChips();
                draw(currentCenter);
            });
        }

        selectedInst.clear();
        renderChips();

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
        idByName = new Map();
        [...nameById].sort((a, b) => d3.ascending(a[1], b[1]))
            .forEach(([id, nm]) => { if (!idByName.has(nm)) idByName.set(nm, id); });

        const dd = d3.select("#netDropdown");
        const allNames = [...idByName.keys()];

        inp.on("input", function () {
            const val = (this.value || "").toLowerCase().trim();
            if (!val) { dd.classed("open", false).html(""); return; }
            const matches = allNames.filter(n => n.toLowerCase().includes(val)).slice(0, 50);

            if (matches.length === 0) dd.classed("open", false);
            else {
                dd.classed("open", true);
                dd.selectAll(".net-dd-item")
                    .data(matches)
                    .join("div")
                    .attr("class", "net-dd-item")
                    .text(d => d)
                    .on("click", (e, d) => {
                        e.stopPropagation();
                        inp.property("value", d);
                        dd.classed("open", false);
                        const id = idByName.get(d);
                        if (id) draw(id);
                    });
            }
        });
        d3.select("body").on("click", () => {
            dd.classed("open", false);
            instDD.classed("open", false);
        });
        instInp.on("click", (e) => e.stopPropagation());
        d3.select("#instBox").on("click", (e) => e.stopPropagation());
        d3.select("#resetBtn").on("click", () => {
            inp.property("value", "");
            currentCenter = null;
            draw(null);
        });
        svg.on("click", tipHide);

        currentCenter = null;
        draw(null);
    }).catch(err => { console.error(err); meta.text("Error: check console."); });

    // main draw function
    function draw(center) {
        currentCenter = center || null;

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
            .attr("stroke", "#8a99ad")
            .attr("stroke-opacity", ego ? .75 : .55)
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

        // nodes as a pie filled with selected institutions
        const arc = d3.arc();
        const R = d => d.id === center ? 8 : (ego ? 8 : 8);

        const node = NG.selectAll("g.node")
            .data(nodes, d => d.id)
            .join(enter => {
                const gn = enter.append("g").attr("class", "node").style("cursor", "pointer");
                gn.append("g").attr("class", "pie");
                gn.append("circle").attr("class", "outline")
                    .attr("r", R)
                    .attr("fill", "none")
                    .attr("stroke", "#fff")
                    .attr("stroke-width", 1.2);
                return gn;
            });

        node
            .on("pointerenter", (e, d) => {
                const ms = matchedInst(d.id);
                const extra = selectedInst.size
                    ? (ms.length
                        ? `<div style="opacity:.85; margin-top:4px">${ms.map(x => `- ${esc(x)}`).join("<br>")}</div>`
                        : `<div style="opacity:.6; margin-top:4px">no match</div>`)
                    : "";
                tipShow(e, `<div><b>${esc(d.name)}</b>${extra}</div>`);
            })
            .on("pointermove", tipMove)
            .on("pointerleave", tipHide)
            .on("click", (e, d) => {
                e.stopPropagation();
                inp.property("value", nameById.get(d.id) || "");
                draw(d.id);
            });

        node.select("circle.outline").attr("r", R);
        node.each(function (d) {
            const gPie = d3.select(this).select("g.pie");
            const ms = matchedInst(d.id);
            const r = R(d);

            gPie.selectAll("circle.centerfill").remove();

            gPie.selectAll("path").remove();

            const baseColor =
                selectedInst.size > 0 && ms.length === 0
                    ? "#a9b2bc"
                    : "#6381b3";

            gPie.selectAll("circle.basefill")
                .data([1])
                .join("circle")
                .attr("class", "basefill")
                .attr("r", r)
                .attr("fill", baseColor);

            if (selectedInst.size === 0 || ms.length === 0) return;

            const n = ms.length;
            gPie.selectAll("path")
                .data(ms, x => x)
                .join("path")
                .attr("fill", x => colorForInst(x))
                .attr("d", (x, i) => arc({
                    innerRadius: 0,
                    outerRadius: r,
                    startAngle: (i / n) * 2 * Math.PI,
                    endAngle: ((i + 1) / n) * 2 * Math.PI
                }));
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
            .force("link", d3.forceLink(links).id(d => d.id).distance(ego ? 88 : 45))
            .force("charge", d3.forceManyBody().strength(ego ? -240 : -12))
            .force("center", d3.forceCenter(W / 2, H / 2))
            .force("collide", d3.forceCollide(d => R(d) + 2).iterations(2))
            .on("tick", () => {
                link
                    .attr("x1", d => d.source.x).attr("y1", d => d.source.y)
                    .attr("x2", d => d.target.x).attr("y2", d => d.target.y);

                node.attr("transform", d => `translate(${d.x},${d.y})`);

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