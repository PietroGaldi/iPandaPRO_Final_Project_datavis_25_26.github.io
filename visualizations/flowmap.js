const width = 1100;
const height = 650;

const colorBg = "#0a0a28"; //#182441, è più chiaro, alternativa al colore di sfondo attuale
const colorLand = "#445879";
const colorLandStroke = "#334155";
const colorNode = "#808da0";
const colorMajor = "#38bdf8";
const colorFlow = "#f472b6";  //#4ade80, è verde ma è una valida alternativa
const colorHover = "#fbbf24";
const colorDim = "#334155";


const majorIds = new Set([
    "https://openalex.org/I30771326",
    "https://openalex.org/I83816512",
    "https://openalex.org/I4210155236"
]);

const regions = {
    "World": { scale: width / 6.3, center: [0, 20] },
    "Europe": { scale: 600, center: [15, 50] },
    "Asia": { scale: 400, center: [90, 30] },
    "USA": { scale: 700, center: [-96, 38] },
    "Italy": { scale: 2300, center: [12.5, 42] }
};

const projection = d3.geoMercator()
    .scale(regions["World"].scale)
    .translate([width / 2, height / 2])
    .center(regions["World"].center);

const path = d3.geoPath().projection(projection);

const container = d3.select("#flow_map");
container.selectAll("*").remove();

const controls = container.append("div")
    .attr("class", "flowmap-control")
    .append("span")
    .text("View:")
    .style("font-size", "13px")
    .style("font-weight", "500");

const regionSelect = controls.append("select");
Object.keys(regions).forEach(r => regionSelect.append("option").text(r).attr("value", r));

const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("background", colorBg)
    .style("display", "block");

Promise.all([
    d3.csv("data/openalex_works_full.csv"),
    d3.csv("data/institutions_osm_coords.csv"),
    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
]).then(([worksRows, coordsRows, worldData]) => {

    // --- STEP A: PROCESS COORDINATES WITH JITTER ---
    const instMap = new Map();
    const coordTracker = new Set(); // Tracks occupied locations

    coordsRows.forEach(row => {
        if (row.coords && row.id) {
            let parts = row.coords.split(",").map(s => parseFloat(s.trim()));
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                let [lat, lon] = parts;

                //IIT
                if (row.id === "https://openalex.org/I30771326") {
                    lat += 0.1;
                    lon += 0.1;
                }
                //San Martino
                if (row.id == "https://openalex.org/I4210146472") {
                    lat += 0.05;
                    lon += 0.3;
                }
                //Esaote
                if (row.id == "https://openalex.org/I4210130470") {
                    lat += 0.05;
                    lon -= 0.2;
                }
                //Galliera
                if (row.id == "https://openalex.org/I3018768319") {
                    lat += 0.05;
                    lon += 0.5;
                }

                let coordKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
                let attempts = 0;
                while (coordTracker.has(coordKey) && attempts < 10) {
                    lat += (Math.random() - 0.5) * 0.1;
                    lon += (Math.random() - 0.5) * 0.1;
                    coordKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
                    attempts++;
                }
                coordTracker.add(coordKey);

                instMap.set(row.id, {
                    id: row.id,
                    name: row.display_name,
                    geoCoords: [lon, lat],
                    isMajor: majorIds.has(row.id)
                });
            }
        }
    });

    // --- STEP B: PROCESS FLOWS (Unchanged) ---
    const allPairs = [];
    worksRows.forEach(row => {
        if (!row.raw_json) return;
        try {
            const data = JSON.parse(row.raw_json);
            const paperInsts = new Set();
            if (data.authorships) {
                data.authorships.forEach(auth => {
                    if (auth.institutions) {
                        auth.institutions.forEach(i => {
                            if (i.id && instMap.has(i.id)) paperInsts.add(i.id);
                        });
                    }
                });
            }
            const ids = Array.from(paperInsts).sort();
            for (let i = 0; i < ids.length; i++) {
                for (let j = i + 1; j < ids.length; j++) {
                    allPairs.push({ sourceId: ids[i], targetId: ids[j], pairId: `${ids[i]}|${ids[j]}` });
                }
            }
        } catch (err) { }
    });

    const pairCounts = d3.rollup(allPairs, v => v.length, d => d.pairId);
    const linksData = Array.from(pairCounts, ([key, count]) => {
        const [sourceId, targetId] = key.split("|");
        return { source: instMap.get(sourceId), target: instMap.get(targetId), value: count };
    }).sort((a, b) => d3.descending(a.value, b.value));

    const connectedIds = new Set();
    linksData.forEach(d => { connectedIds.add(d.source.id); connectedIds.add(d.target.id); });
    const nodesData = Array.from(connectedIds).map(id => instMap.get(id))
        .sort((a, b) => (a.isMajor === b.isMajor) ? 0 : a.isMajor ? 1 : -1);

    const maxCount = d3.max(linksData, d => d.value) || 1;
    const strokeScale = d3.scaleSqrt().domain([1, maxCount]).range([0.9, 15]);
    const opacityScale = d3.scaleLinear().domain([1, maxCount]).range([0.3, 0.6]);

    const g = svg.append("g");

    const countries = topojson.feature(worldData, worldData.objects.countries);
    const mapPath = g.append("g").selectAll("path")
        .data(countries.features).enter().append("path")
        .attr("d", path)
        .attr("fill", colorLand)
        .attr("stroke", colorLandStroke)
        .attr("stroke-width", 0.5);

    const linkElements = g.append("g").selectAll("path")
        .data(linksData).enter().append("path")
        .attr("fill", "none")
        .attr("stroke", colorFlow)
        .attr("stroke-width", d => strokeScale(d.value))
        .attr("stroke-opacity", d => opacityScale(d.value))
        .attr("stroke-linecap", "round");

    const nodeElements = g.append("g").selectAll("circle")
        .data(nodesData).enter().append("circle")
        .attr("r", d => d.isMajor ? 6 : 4)
        .attr("fill", d => d.isMajor ? colorMajor : colorNode)
        .attr("stroke", colorBg)
        .attr("stroke-width", 1.5)
        .style("filter", d => d.isMajor ? "url(#glow)" : "none")
        .style("cursor", "pointer");

    function updatePositions() {
        mapPath.attr("d", path);
        nodesData.forEach(d => {
            const [x, y] = projection(d.geoCoords);
            d.x = x;
            d.y = y;
        });

        nodeElements
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);

        linkElements.attr("d", d => {
            return `M${d.source.x},${d.source.y} L${d.target.x},${d.target.y}`;
        });
    }
    updatePositions();

    regionSelect.on("change", function () {
        const settings = regions[d3.select(this).property("value")];
        d3.transition().duration(1500)
            .tween("projection", () => {
                const ix = d3.interpolate(projection.scale(), settings.scale);
                const iy = d3.interpolate(projection.center(), settings.center);
                return (t) => {
                    projection.scale(ix(t)).center(iy(t));
                    updatePositions();
                };
            });
    });

    const tooltip = d3.select(".flowmap-tooltip").empty()
        ? d3.select("body").append("div").attr("class", "flowmap-tooltip")
        : d3.select(".flowmap-tooltip");

    let selectedNodeId = null;

    function updateHighlight() {
        if (selectedNodeId) {
            linkElements.transition().duration(200)
                .attr("stroke", d => (d.source.id === selectedNodeId || d.target.id === selectedNodeId) ? colorHover : colorFlow)
                .attr("stroke-opacity", d => (d.source.id === selectedNodeId || d.target.id === selectedNodeId) ? 1 : 0.05);

            nodeElements.transition().duration(200)
                .attr("fill", d => (d.id === selectedNodeId ? colorHover : (d.isMajor ? colorMajor : colorNode)))
                .attr("r", d => d.id === selectedNodeId ? 8 : (d.isMajor ? 6 : 4))
                .attr("opacity", d => {
                    if (d.id === selectedNodeId) return 1;
                    const isNeighbor = linksData.some(l =>
                        (l.source.id === selectedNodeId && l.target.id === d.id) ||
                        (l.target.id === selectedNodeId && l.source.id === d.id));
                    return isNeighbor ? 1 : 0.2;
                });
        } else {
            linkElements.transition().duration(200)
                .attr("stroke", colorFlow)
                .attr("stroke-opacity", d => opacityScale(d.value));

            nodeElements.transition().duration(200)
                .attr("fill", d => d.isMajor ? colorMajor : colorNode)
                .attr("r", d => d.isMajor ? 6 : 4)
                .attr("opacity", 1);
        }
    }

    nodeElements.on("click", (event, d) => {
        event.stopPropagation();
        selectedNodeId = (selectedNodeId === d.id) ? null : d.id;
        updateHighlight();
        if (selectedNodeId) {
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(`<b>${d.name}</b>`).style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 28) + "px");
        } else {
            tooltip.transition().duration(200).style("opacity", 0);
        }
    });

    svg.on("click", () => {
        if (selectedNodeId) { selectedNodeId = null; updateHighlight(); tooltip.transition().duration(200).style("opacity", 0); }
    });

    nodeElements.on("mouseenter", (event, d) => {
        tooltip.transition().duration(100).style("opacity", 1);
        tooltip.html(`<b>${d.name}</b>`).style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 28) + "px");

        if (selectedNodeId) {
            d3.select(event.target).transition().duration(100).attr("fill", colorHover).attr("r", 8).attr("opacity", 1);
        } else {
            d3.select(event.target).transition().duration(100).attr("fill", colorHover).attr("r", 8).style("filter", "url(#glow)");
            linkElements.transition().duration(100).attr("stroke", l => (l.source.id === d.id || l.target.id === d.id) ? colorHover : colorFlow).attr("stroke-opacity", l => (l.source.id === d.id || l.target.id === d.id) ? 0.8 : 0.1);
        }
    }).on("mouseleave", (event, d) => {
        tooltip.transition().duration(200).style("opacity", 0);
        if (selectedNodeId) {
            updateHighlight();
        } else {
            d3.select(event.target).transition().duration(200).attr("fill", d.isMajor ? colorMajor : colorNode).attr("r", d.isMajor ? 6 : 4).style("filter", d.isMajor ? "url(#glow)" : "none");
            linkElements.transition().duration(200).attr("stroke", colorFlow).attr("stroke-opacity", d => opacityScale(d.value));
        }
    });

    const legendGroup = svg.append("g")
        .attr("class", "map-legend")
        .attr("transform", `translate(40, ${height - 120})`);

    legendGroup.append("rect")
        .attr("x", -15)
        .attr("y", -25)
        .attr("width", 140)
        .attr("height", 110)
        .attr("fill", "#0f172a")
        .attr("opacity", 0.8)
        .attr("rx", 8);

    legendGroup.append("text")
        .text("Collaborations")
        .attr("x", 0)
        .attr("y", -5)
        .style("fill", "#e2e8f0")
        .style("font-size", "12px")
        .style("font-weight", "600")
        .style("font-family", "'Fira Sans', sans-serif")

    const legendValues = [
        1,
        Math.round(maxCount / 4),
        maxCount
    ];

    legendValues.forEach((val, i) => {
        const yOffset = i * 25 + 20;

        legendGroup.append("line")
            .attr("x1", 0)
            .attr("x2", 40)
            .attr("y1", yOffset)
            .attr("y2", yOffset)
            .attr("stroke", colorFlow)
            .attr("stroke-width", strokeScale(val))
            .attr("stroke-opacity", 0.8)
            .attr("stroke-linecap", "round");

        legendGroup.append("text")
            .text(() => {
                if (val === maxCount) return `${val}+ works`;
                if (val === 1) return "1 work";              
                return `${val} works`;                       
            })
            .attr("x", 55)
            .attr("y", yOffset + 4)
            .style("fill", "#94a3b8")
            .style("font-size", "11px")
            .style("font-family", "'Fira Sans', sans-serif");
    });
});