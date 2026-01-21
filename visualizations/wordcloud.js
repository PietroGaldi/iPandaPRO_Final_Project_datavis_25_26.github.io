d3.csv("data/openalex_works_full.csv").then(rows => {
    
    // --- Configuration ---
    const containerSelector = "#topics_wordcloud";
    const getWidth = () => document.querySelector(containerSelector).getBoundingClientRect().width || 600;
    
    const H_TOPICS = 600; 
    const H_CATS = 300;
    const MARGIN = { top: 10, right: 10, bottom: 10, left: 10 };
    
    const FONT_FAMILY = "'Fira Sans', sans-serif";

    const modernPalette = [
        "#5e96f0", "#ef4444", "#10b981", "#f59e0b", "#4749d1",
        "#ec4899", "#8b5cf6", "#13d1bb", "#f97316", "#84cc16",
        "#119ab2", "#64748b"
    ];
    
    const colorScale = d3.scaleOrdinal(modernPalette);

    // --- Helpers ---
    function makeSeededRandom(seedStr) {
        let seed = 0;
        for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
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

    // --- Data Processing ---
    const freqCategory = new Map();
    const freqTopic = new Map();
    
    // Logic: Exactly matching your Leaderboard
    // Maps Topic Name -> Category Name based on the first time we see the topic.
    const topicToCategoryMap = new Map(); 

    rows.forEach(r => {
        const obj = safeParseRawJson(r.raw_json);
        if (!obj || !obj.concepts) return;

        // 1. Get Category (Level 0)
        // Sort by score to find the most relevant L0
        const l0 = obj.concepts
            .filter(c => c.level === 0 && c.display_name)
            .sort((a, b) => (b.score || 0) - (a.score || 0))[0];
        
        const catName = l0 ? String(l0.display_name).trim() : null;
        if (catName) {
            freqCategory.set(catName, (freqCategory.get(catName) || 0) + 1);
        }

        // 2. Get Topics (Level 1)
        const l1s = obj.concepts
            .filter(c => c.level === 1 && c.display_name)
            .map(c => ({ name: String(c.display_name).trim() }));

        l1s.forEach(t => {
            // Count frequency for sizing
            freqTopic.set(t.name, (freqTopic.get(t.name) || 0) + 1);
            
            // LEADERBOARD LOGIC:
            // If we have a category for this paper, and this topic hasn't been assigned a category yet,
            // assign it now. This effectively "locks" the topic to the first category it appears with.
            if (catName && !topicToCategoryMap.has(t.name)) {
                topicToCategoryMap.set(t.name, catName);
            }
        });
    });

    // Helper to retrieve the assigned category
    function resolveTopicToCategory(topicName) {
        return topicToCategoryMap.get(topicName) || "Unknown";
    }

    function getColor(text, mode) {
        let category = text;
        // If we are coloring a Topic, look up its mapped parent Category
        if (mode === "topics") {
            category = resolveTopicToCategory(text);
        }
        return colorScale(category);
    }

    // --- Setup D3 ---
    const root = d3.select(containerSelector);
    root.selectAll("*").remove();

    const svg = root.append("svg")
        .attr("width", "100%")
        .attr("height", H_TOPICS) // Start with Topics height (Default)
        .style("transition", "height 0.3s ease");

    const g = svg.append("g");

    const layoutCache = new Map();
    let currentMode = "topics"; // Default is Topics

    // --- Main Render Function ---
    async function renderCloud(mode) {
        currentMode = mode;
        const width = getWidth();
        
        const isCats = mode === "cats";
        const H = isCats ? H_CATS : H_TOPICS;
        const MAX_WORDS = isCats ? 50 : 250; 

        svg.transition().duration(300).attr("height", H);
        
        const sourceMap = isCats ? freqCategory : freqTopic;
        const items = Array.from(sourceMap, ([text, count]) => ({ text, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, MAX_WORDS);

        const extent = d3.extent(items, d => d.count);
        const sizeScale = d3.scaleSqrt()
            .domain(extent)
            .range(isCats ? [18, 50] : [12, 45]);

        const wordsData = items.map(d => ({
            text: d.text,
            count: d.count,
            size: sizeScale(d.count),
            color: getColor(d.text, mode)
        }));

        const innerW = width - MARGIN.left - MARGIN.right;
        const innerH = H - MARGIN.top - MARGIN.bottom;
        const cacheKey = `${mode}-${Math.floor(width/50)*50}-${H}`;
        
        let layoutWords = layoutCache.get(cacheKey);

        if (!layoutWords) {
            const seedStr = `seed:${mode}:${items.length}`;
            layoutWords = await new Promise(resolve => {
                d3.layout.cloud()
                    .size([innerW, innerH])
                    .words(wordsData)
                    .padding(isCats ? 15 : 4) 
                    .rotate(d => {
                        if (isCats) return 0; 
                        return (makeSeededRandom(seedStr + d.text)() > 0.85 ? 90 : 0);
                    })
                    .font("Fira Sans")
                    .fontWeight(d => d.size > 30 ? 600 : 400)
                    .fontSize(d => d.size)
                    .random(makeSeededRandom(seedStr))
                    .on("end", resolve)
                    .start();
            });
            layoutCache.set(cacheKey, layoutWords);
        }

        g.transition().duration(300)
         .attr("transform", `translate(${width / 2}, ${H / 2})`);

        const sel = g.selectAll("text").data(layoutWords, d => d.text);

        sel.exit()
            .transition().duration(200)
            .style("opacity", 0)
            .remove();

        const enter = sel.enter().append("text")
            .attr("class", "wc-word")
            .style("font-family", FONT_FAMILY)
            .attr("text-anchor", "middle")
            .style("opacity", 0)
            .attr("transform", d => `translate(${d.x},${d.y})scale(0.5)`)
            .text(d => d.text);

        sel.merge(enter)
            .transition().duration(400).ease(d3.easeBackOut)
            .style("opacity", 1)
            .style("fill", d => d.color)
            .style("font-size", d => d.size + "px")
            .style("font-weight", d => d.size > 28 ? "600" : "400")
            .attr("transform", d => `translate(${d.x},${d.y})rotate(${d.rotate})`);
    }

    const btns = d3.selectAll(".wc-toggle-btn");
    
    btns.on("click", function() {
        const btn = d3.select(this);
        const mode = btn.attr("data-mode");
        btns.classed("active", false);
        btn.classed("active", true);
        renderCloud(mode);
    });

    window.addEventListener("resize", () => {
        renderCloud(currentMode);
    });

    renderCloud("topics");
});