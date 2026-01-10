d3.csv("data/openalex_works_full.csv").then(rows => {
  const container = "#topics_wordcloud";
  const W = 570;
  const H = 450;

  const margin = { top: 35, right: 30, bottom: 40, left: 10 };
  const width = W;
  const height = H;

  const BG = "#ffffff";

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
    .range([10, 54]);

  const color = d3.scaleOrdinal()
    .domain(items.map(d => d.text))
    .range(d3.range(items.length).map(i => palette[i % palette.length]));

  d3.select(container).selectAll("*").remove();

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

  const words = items.map(d => ({
    text: d.text,
    count: d.count,
    size: sizeScale(d.count)
  }));

  d3.layout.cloud()
    .size([width - margin.left - margin.right, height - margin.top - margin.bottom])
    .words(words)
    .rotate(() => (Math.random() < 0.18 ? 90 : 0))
    .font("system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif")
    .fontSize(d => d.size)
    .on("end", draw)
    .start();

  function draw(layoutWords) {
    cloudG.selectAll("text.word")
      .data(layoutWords, d => d.text)
      .enter()
      .append("text")
      .attr("class", "word")
      .style("font-family", "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif")
      .style("font-size", d => d.size + "px")
      .style("fill", d => color(d.text))
      .attr("text-anchor", "middle")
      .attr("transform", d => "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")")
      .text(d => d.text);
  }
});
