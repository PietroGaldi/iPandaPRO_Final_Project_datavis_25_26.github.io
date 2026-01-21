d3.csv("data/openalex_works_full.csv").then(rows => {
  const container = "#topics_wordcloud";
  const W = 570;

  const H_TOPICS = 400;
  const H_CATS = 200;

  const margin = { top: 35, right: 30, bottom: 18, left: 10 };
  const width = W;
  const BG = "#f8fafc";

  const palette = [
    "#2563eb", "#dc2626", "#16a34a", "#f59e0b", "#7c3aed",
    "#06b6d4", "#db2777", "#84cc16", "#f97316", "#0ea5e9",
    "#a855f7", "#14b8a6", "#e11d48", "#22c55e", "#fb7185",
    "#c026d3", "#8b5cf6", "#64748b", "#111827", "#f43f5e"
  ];

  const FONT = "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";

  function makeSeededRandom(seedStr) {
    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) {
      seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
    }
    return function () {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function safeParseRawJson(raw) {
    if (!raw) return null;
    try {
      const s = raw.startsWith('"') ? raw.slice(1, -1).replace(/""/g, '"') : raw;
      return JSON.parse(s);
    } catch (e) {
      try { return JSON.parse(raw); } catch (e2) { return null; }
    }
  }

  function extractTopConceptL0(obj) {
    if (!obj || !Array.isArray(obj.concepts)) return null;
    return obj.concepts
      .filter(c => c && c.level === 0 && c.display_name)
      .sort((a, b) => (b.score || 0) - (a.score || 0))[0] || null;
  }

  function extractConceptLevel(obj, level) {
    if (!obj || !Array.isArray(obj.concepts)) return [];
    return obj.concepts
      .filter(c => c && c.level === level && c.display_name)
      .map(c => ({ name: String(c.display_name).trim(), score: c.score || 0 }))
      .filter(d => d.name);
  }

  const freqCategory = new Map();
  const freqTopic = new Map();
  const topicCatVotes = new Map();

  rows.forEach(r => {
    const obj = safeParseRawJson(r.raw_json);
    if (!obj) return;

    const l0 = extractTopConceptL0(obj);
    const cat = l0 && l0.display_name ? String(l0.display_name).trim() : null;

    if (cat) freqCategory.set(cat, (freqCategory.get(cat) || 0) + 1);

    const l1s = extractConceptLevel(obj, 1);
    l1s.forEach(t => {
      freqTopic.set(t.name, (freqTopic.get(t.name) || 0) + 1);
      if (cat) {
        if (!topicCatVotes.has(t.name)) topicCatVotes.set(t.name, new Map());
        const m = topicCatVotes.get(t.name);
        m.set(cat, (m.get(cat) || 0) + 1);
      }
    });
  });

  function resolveTopicToCategory(topicName) {
    const votes = topicCatVotes.get(topicName);
    if (!votes) return null;
    let bestCat = null, best = -1;
    for (const [cat, count] of votes.entries()) {
      if (count > best) { best = count; bestCat = cat; }
    }
    return bestCat;
  }

  const categoriesSorted = Array.from(freqCategory.keys()).sort(d3.ascending);
  const categoryColor = new Map(categoriesSorted.map((c, i) => [c, palette[i % palette.length]]));
  const fallbackColor = "#64748b";

  function colorFor(mode, text) {
    if (mode === "cats") return categoryColor.get(text) || fallbackColor;
    const cat = resolveTopicToCategory(text);
    return cat ? (categoryColor.get(cat) || fallbackColor) : fallbackColor;
  }

  const root = d3.select(container);
  root.selectAll("*").remove();

  const controls = root.append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "10px")
    .style("margin-bottom", "8px")
    .style("font-family", FONT);

  const toggleWrap = controls.append("div")
    .style("display", "inline-flex")
    .style("border", "1px solid #e2e8f0")
    .style("border-radius", "999px")
    .style("overflow", "hidden");

  const btnTopics = toggleWrap.append("button")
    .attr("type", "button")
    .style("padding", "6px 10px")
    .style("font-size", "12px")
    .style("border", "0")
    .style("background", "#ffffff")
    .style("color", "#0f172a")
    .style("cursor", "pointer")
    .text("Topics");

  const btnCats = toggleWrap.append("button")
    .attr("type", "button")
    .style("padding", "6px 10px")
    .style("font-size", "12px")
    .style("border", "0")
    .style("background", "#0f172a")
    .style("color", "#ffffff")
    .style("cursor", "pointer")
    .text("Categories");

  controls.append("div")
    .style("font-size", "11px")
    .style("color", "#94a3b8")
    .text("Click to switch");

  const svg = root.append("svg")
    .attr("width", width);

  const bgRect = svg.append("rect")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("fill", BG)
    .attr("rx", 12);

  const cloudG = svg.append("g");

  const layoutCache = new Map();

  function makeItems(freqMap) {
    return Array.from(freqMap, ([text, count]) => ({ text, count }))
      .sort((a, b) => d3.descending(a.count, b.count));
  }

  function computeLayout(words, seedStr, innerW, innerH) {
    return new Promise(resolve => {
      d3.layout.cloud()
        .size([innerW, innerH])
        .words(words)
        .padding(1)
        .rotate(d => (makeSeededRandom(seedStr + "::rot::" + d.text)() < 0.12 ? 90 : 0))
        .font(FONT)
        .fontSize(d => d.size)
        .random(makeSeededRandom(seedStr))
        .on("end", resolve)
        .start();
    });
  }

  async function renderCloud(mode) {
    const H = (mode === "cats") ? H_CATS : H_TOPICS;

    svg.transition().duration(250).attr("height", H);

    bgRect.transition().duration(250)
      .attr("width", width - margin.left - margin.right)
      .attr("height", H - margin.top - margin.bottom);

    cloudG.transition().duration(250)
      .attr("transform", `translate(${width / 2}, ${(margin.top + (H - margin.bottom)) / 2})`);

    const items = mode === "topics" ? makeItems(freqTopic) : makeItems(freqCategory);

    const maxCount = d3.max(items, d => d.count) || 1;
    const minCount = d3.min(items, d => d.count) || 1;

    const sizeScale = d3.scaleSqrt()
      .domain([minCount, maxCount])
      .range([10, mode === "topics" ? 40 : 44]);

    const MAX_WORDS = mode === "topics" ? 60 : 25;
    const words = items.slice(0, MAX_WORDS).map(d => ({
      text: d.text,
      count: d.count,
      size: sizeScale(d.count)
    }));

    const innerW = width - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;

    const cacheKey = `${mode}:N${words.length}:W${width}:H${H}`;
    let layoutWords = layoutCache.get(cacheKey);

    if (!layoutWords) {
      const seedStr = `wc:${mode}:W${width}:H${H}:N${words.length}`;
      layoutWords = await computeLayout(words, seedStr, innerW, innerH);
      layoutCache.set(cacheKey, layoutWords);
    }

    draw(layoutWords, mode);
  }

  function draw(layoutWords, mode) {
    const sel = cloudG.selectAll("text.word")
      .data(layoutWords, d => d.text);

    sel.exit()
      .transition()
      .duration(150)
      .style("opacity", 0)
      .remove();

    const enter = sel.enter()
      .append("text")
      .attr("class", "word")
      .style("font-family", FONT)
      .attr("text-anchor", "middle")
      .style("opacity", 0)
      .text(d => d.text);

    enter.merge(sel)
      .transition()
      .duration(250)
      .style("opacity", 1)
      .style("font-size", d => d.size + "px")
      .style("fill", d => colorFor(mode, d.text))
      .attr("transform", d => `translate(${d.x},${d.y})rotate(${d.rotate})`);
  }

  function setActive(which) {
    const onBg = "#0f172a", onFg = "#ffffff";
    const offBg = "#ffffff", offFg = "#0f172a";

    if (which === "topics") {
      btnTopics.style("background", onBg).style("color", onFg);
      btnCats.style("background", offBg).style("color", offFg);
    } else {
      btnCats.style("background", onBg).style("color", onFg);
      btnTopics.style("background", offBg).style("color", offFg);
    }
  }

  btnTopics.on("click", async () => {
    setActive("topics");
    await renderCloud("topics");
  });

  btnCats.on("click", async () => {
    setActive("cats");
    await renderCloud("cats");
  });

  setActive("cats");

  svg.attr("height", H_CATS);
  bgRect
    .attr("width", width - margin.left - margin.right)
    .attr("height", H_CATS - margin.top - margin.bottom);
  cloudG.attr("transform", `translate(${width / 2}, ${(margin.top + (H_CATS - margin.bottom)) / 2})`);

  renderCloud("cats");
});