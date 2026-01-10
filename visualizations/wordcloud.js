d3.csv("data/openalex_works_full.csv").then(rows => {
  const container = "#topics_wordcloud";
  const W = 1300;
  const H = 500;

  const margin = { top: 70, right: 30, bottom: 40, left: 30 };
  const width = W;
  const height = H;

  const BG = "#ffffff";
  const TEXT = "#1f2937";
  const MUTED = "#6b7280";
  const BORDER = "#e5e7eb";

  const palette = [
    "#0072B2", "#E69F00", "#009E73", "#D55E00",
    "#CC79A7", "#56B4E9", "#F0E442", "#000000", "#7f7f7f"
  ];

  function safeJsonParse(s) {
    try { return JSON.parse(s); } catch (e) { return null; }
  }

  function extractTopicNames(rawJsonStr) {
    const obj = safeJsonParse(rawJsonStr);
    if (!obj) return [];

    if (Array.isArray(obj.topics) && obj.topics.length) {
      return obj.topics
        .map(t => t && t.display_name ? String(t.display_name).trim() : null)
        .filter(Boolean);
    }

    if (Array.isArray(obj.concepts) && obj.concepts.length) {
      return obj.concepts
        .map(c => c && c.display_name ? String(c.display_name).trim() : null)
        .filter(Boolean);
    }

    return [];
  }

  const freq = new Map();

  rows.forEach(r => {
    const topics = extractTopicNames(r.raw_json);
    topics.forEach(t => {
      freq.set(t, (freq.get(t) || 0) + 1);
    });
  });

  let items = Array.from(freq, ([text, count]) => ({ text, count }))
    .sort((a, b) => d3.descending(a.count, b.count));

  const maxCount = d3.max(items, d => d.count) || 1;
  const minCount = d3.min(items, d => d.count) || 1;

  const sizeScale = d3.scaleSqrt()
    .domain([minCount, maxCount])
    .range([10, 64]);

  const color = d3.scaleOrdinal()
    .domain(items.map(d => d.text))
    .range(d3.range(items.length).map(i => palette[i % palette.length]));

  d3.select(container).selectAll("*").remove();

  const tip = d3.select("body")
    .selectAll("div.wordcloud-tip")
    .data([null])
    .join("div")
    .attr("class", "wordcloud-tip")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("padding", "8px 10px")
    .style("background", "rgba(17,24,39,0.92)")
    .style("color", "#ffffff")
    .style("border-radius", "8px")
    .style("font-size", "12px")
    .style("box-shadow", "0 6px 18px rgba(0,0,0,0.2)")
    .style("opacity", 0);

  const svg = d3.select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  svg.append("rect")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width", width - margin.left - margin.right)
    .attr("height", height - margin.top - margin.bottom)
    .attr("fill", BG)
    .attr("rx", 12);

  const cloudG = svg.append("g")
    .attr("transform", "translate(" + (width / 2) + "," + ((margin.top + (height - margin.bottom)) / 2) + ")");

  let selected = null;

  function applySelection(wordSel) {
    wordSel.attr("opacity", d => {
      if (!selected) return 1;
      return d.text === selected ? 1 : 0.15;
    });
  }

  function setSubtitleForSelection() {
    if (!selected) {
      subtitle.text("Hover for counts. Click a topic to pin highlight. Click again to reset.");
      return;
    }
    const m = items.find(x => x.text === selected);
    if (!m) return;
    subtitle.text("Selected: " + m.text + " | occurrences: " + m.count.toLocaleString() + " | click again to reset");
  }

  const words = items.map(d => ({
    text: d.text,
    count: d.count,
    size: sizeScale(d.count)
  }));

  d3.layout.cloud()
    .size([width - margin.left - margin.right, height - margin.top - margin.bottom])
    .words(words)
    .padding(2)
    .rotate(() => (Math.random() < 0.18 ? 90 : 0))
    .font("system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif")
    .fontSize(d => d.size)
    .on("end", draw)
    .start();

  function draw(layoutWords) {
    const wordSel = cloudG.selectAll("text.word")
      .data(layoutWords, d => d.text)
      .enter()
      .append("text")
      .attr("class", "word")
      .style("font-family", "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif")
      .style("font-size", d => d.size + "px")
      .style("fill", d => color(d.text))
      .attr("text-anchor", "middle")
      .attr("transform", d => "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")")
      .text(d => d.text)
      .style("cursor", "pointer");

    wordSel
      .on("mouseenter", function () {
        d3.select(this).attr("opacity", 0.85);
      })
      .on("mousemove", (event, d) => {
        tip
          .style("opacity", 1)
          .html("<strong>" + d.text + "</strong><br>occurrences: " + d.count.toLocaleString() + "<br>click to pin")
          .style("left", (event.pageX + 12) + "px")
          .style("top", (event.pageY - 12) + "px");
      })
      .on("mouseleave", function () {
        tip.style("opacity", 0);
        if (!selected) d3.select(this).attr("opacity", 1);
        else d3.select(this).attr("opacity", d3.select(this).text() === selected ? 1 : 0.15);
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        if (selected === d.text) selected = null;
        else selected = d.text;
        setSubtitleForSelection();
        applySelection(wordSel);
      });

    applySelection(wordSel);

    svg.on("click", () => {
      selected = null;
      setSubtitleForSelection();
      applySelection(wordSel);
    });
  }
});
