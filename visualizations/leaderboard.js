{
    const width = 1100;

    const container = d3.select("#leaderboard");
    container.selectAll("*").remove();

    const modernPalette = [
        "#5e96f0",
        "#ef4444",
        "#10b981",
        "#f59e0b",
        "#4749d1",
        "#ec4899",
        "#8b5cf6",
        "#13d1bb",
        "#f97316",
        "#84cc16",
        "#119ab2",
        "#64748b"
    ];

    const colorScale = d3.scaleOrdinal(modernPalette);

    let allAuthors = [];
    let currentFilterTerm = "";
    let currentCategoryFilter = null;
    let topicToCategoryMap = new Map();

    const wrapper = container.append("div")
        .attr("class", "lb_grid")
        .style("max-width", `${width}px`);

    const chartCard = wrapper.append("div")
        .attr("class", "lb_card");

    const header = chartCard.append("div")
        .attr("class", "lb_header");

    const titleRow = header.append("div")
        .attr("class", "lb_title_row");

    titleRow.append("div")
        .attr("class", "lb_title")
        .text("Researcher Leaderboard");

    const searchInput = header.append("input")
        .attr("type", "text")
        .attr("class", "lb_search")
        .attr("placeholder", "Search person...")
        .on("input", function () {
            currentFilterTerm = this.value.toLowerCase();
            applyFilters();
        });

    header.append("div")
        .style("font-size", "11px")
        .style("color", "#94a3b8")
        .style("font-weight", "500")
        .style("margin-bottom", "-8px")
        .style("margin-top", "4px")
        .text("Click a category below to filter:");

    const legendContainer = header.append("div")
        .attr("class", "lb_legend_container");

    const chartBody = chartCard.append("div")
        .attr("class", "lb_scroll_area modern-scroll");

    const detailsCol = wrapper.append("div")
        .attr("class", "lb_card");

    const detailsContent = detailsCol.append("div")
        .attr("class", "lb_details_content modern-scroll")
        .html(`<div class="lb_empty_state">
             Select a researcher to view their topic landscape.
           </div>`);

    // Data Processing
    Promise.all([
        d3.csv("data/openalex_people.csv"),
        d3.csv("data/openalex_works_full.csv")
    ]).then(([peopleData, worksData]) => {

        const peopleMap = new Map();
        peopleData.forEach(p => {
            if (p.openalex_id && p.openalex_id.trim() !== "") {
                peopleMap.set(p.openalex_id.trim(), p.display_name_or_alias);
            }
        });

        const authorStats = new Map();

        worksData.forEach(work => {
            if (!work.raw_json) return;
            try {
                let jsonStr = work.raw_json.startsWith('"') ? work.raw_json.slice(1, -1).replace(/""/g, '"') : work.raw_json;
                const data = JSON.parse(jsonStr);

                if (data.authorships && data.concepts) {
                    const authors = data.authorships.map(a => a.author.id.trim()).filter(id => peopleMap.has(id));
                    const l0 = data.concepts.filter(c => c.level === 0).sort((a, b) => b.score - a.score)[0];
                    const l1s = data.concepts.filter(c => c.level === 1);

                    if (l0) {
                        l1s.forEach(t => {
                            if (!topicToCategoryMap.has(t.display_name)) {
                                topicToCategoryMap.set(t.display_name, l0.display_name);
                            }
                        });
                    }

                    if (authors.length > 0) {
                        authors.forEach(authId => {
                            if (!authorStats.has(authId)) {
                                authorStats.set(authId, {
                                    id: authId,
                                    name: peopleMap.get(authId),
                                    totalCount: 0,
                                    categories: {},
                                    topics: {}
                                });
                            }
                            const stat = authorStats.get(authId);
                            stat.totalCount += 1;
                            if (l0) stat.categories[l0.display_name] = (stat.categories[l0.display_name] || 0) + 1;
                            l1s.forEach(c => stat.topics[c.display_name] = (stat.topics[c.display_name] || 0) + 1);
                        });
                    }
                }
            } catch (e) { }
        });

        allAuthors = Array.from(authorStats.values()).map(d => {
            let maxCat = "Unknown";
            let maxCatCount = 0;
            for (const [cat, count] of Object.entries(d.categories)) {
                if (count > maxCatCount) {
                    maxCatCount = count;
                    maxCat = cat;
                }
            }
            const sortedTopics = Object.entries(d.topics).map(([name, count]) => ({
                name,
                count
            })).sort((a, b) => b.count - a.count);
            return {
                ...d,
                primaryCategory: maxCat,
                topTopics: sortedTopics
            };
        });

        allAuthors.sort((a, b) => b.totalCount - a.totalCount);

        renderLegend(allAuthors);
        applyFilters();

    }).catch(console.error);

    function renderLegend(data) {
        const uniqueCategories = Array.from(new Set(data.map(d => d.primaryCategory))).sort();

        uniqueCategories.forEach(cat => {
            if (cat === "Unknown") return;

            const item = legendContainer.append("div")
                .attr("class", "lb_legend_item")
                .on("click", function () {
                    if (currentCategoryFilter === cat) {
                        currentCategoryFilter = null;
                        detailsContent.html(`<div class="lb_empty_state">
                            Select a researcher to view their topic landscape.
                        </div>`);
                    } else {
                        currentCategoryFilter = cat;
                        showCategorySummary(cat);
                    }
                    updateLegendVisuals();
                    applyFilters();
                });

            item.append("div")
                .style("width", "10px")
                .style("height", "10px")
                .style("border-radius", "50%")
                .style("background", colorScale(cat));

            item.append("div")
                .attr("class", "lb_legend_text")
                .text(cat);

            item.datum(cat);
        });

        updateLegendVisuals();
    }

    function updateLegendVisuals() {
        legendContainer.selectAll(".lb_legend_item")
            .style("background", d => d === currentCategoryFilter ? "#e2e8f0" : "#f8fafc")
            .style("border-color", d => d === currentCategoryFilter ? "#94a3b8" : "transparent")
            .style("opacity", d => (currentCategoryFilter && d !== currentCategoryFilter) ? 0.5 : 1);
    }

    function applyFilters() {
        const filtered = allAuthors.filter(d => {
            const matchesSearch = d.name.toLowerCase().includes(currentFilterTerm);
            const matchesCategory = currentCategoryFilter ? d.primaryCategory === currentCategoryFilter : true;
            return matchesSearch && matchesCategory;
        });

        renderList(filtered);
    }

    function renderList(data) {
        chartBody.html("");

        if (data.length === 0) {
            chartBody.html(`<div style="padding:40px; text-align:center; color:#94a3b8;">No matches found.</div>`);
            return;
        }

        const globalMax = allAuthors.length > 0 ? allAuthors[0].totalCount : 100;
        const barScale = d3.scaleLinear().domain([0, globalMax]).range([0, 100]);

        const rows = chartBody.selectAll(".lb_row")
            .data(data)
            .enter().append("div")
            .attr("class", "lb_row")
            .on("click", (e, d) => showProfile(d));

        rows.append("div")
            .attr("class", "lb_rank")
            .text((d, i) => i + 1);

        const infoCol = rows.append("div")
            .attr("class", "lb_row_info");

        infoCol.append("div")
            .attr("class", "lb_row_name")
            .text(d => d.name);

        const barContainer = infoCol.append("div")
            .attr("class", "lb_bar_container");

        barContainer.append("div")
            .style("height", "6px")
            .style("border-radius", "3px")
            .style("background", d => colorScale(d.primaryCategory))
            .style("width", d => `${Math.max(1, barScale(d.totalCount))}%`);

        barContainer.append("div")
            .attr("class", "lb_count_text")
            .text(d => `${d.totalCount} works`);
    }

    function showCategorySummary(category) {
        const relevantAuthors = allAuthors.filter(d => d.primaryCategory === category);
        const totalAuthors = relevantAuthors.length;
        const totalPubs = relevantAuthors.reduce((acc, curr) => acc + curr.totalCount, 0);

        const color = colorScale(category);

        let html = `
        <div class="lb_profile_header" style="border-bottom: 1px solid #e2e8f0;">
            <div class="lb_avatar" style="background:${color}; width: 56px; height: 56px; font-size: 22px;">
                ${category.charAt(0)}
            </div>
            <div class="lb_profile_name" style="font-size: 18px;">${category}</div>
        </div>

        <div style="padding: 20px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div style="background: #f8fafc; padding: 16px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0;">
                    <div style="font-size: 24px; font-weight: 700; color: #334155;">${totalAuthors}</div>
                    <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-top: 4px;">Authors</div>
                </div>

                <div style="background: #f8fafc; padding: 16px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0;">
                    <div style="font-size: 24px; font-weight: 700; color: #334155;">${totalPubs}</div>
                    <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-top: 4px;">Publications</div>
                </div>
            </div>
        </div>
        `;

        detailsContent.html(html);
    }

    function showProfile(d) {
        const primaryColor = colorScale(d.primaryCategory);

        let html = `
        <div class="lb_profile_header">
            <div class="lb_avatar" style="background:${primaryColor};">
                ${d.name.charAt(0)}
            </div>
            <div class="lb_profile_name">${d.name}</div>
            <div class="lb_profile_meta">
                ${d.primaryCategory}: ${d.totalCount} Publications
            </div>
        </div>

        <div class="lb_section_label">
            Focus Topics
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
    `;

        d.topTopics.slice(0, 20).forEach(t => {
            const percent = (t.count / d.totalCount) * 100;
            const trueCategory = topicToCategoryMap.get(t.name) || "Other";
            const topicColor = colorScale(trueCategory);

            html += `
        <div class="lb_topic_row">
            <span class="lb_topic_name" title="${t.name} (${trueCategory})">${t.name}</span>
            <div class="lb_topic_bar_wrap">
                <div class="lb_topic_track">
                    <div style="width:${percent}%; height:100%; background:${topicColor};"></div>
                </div>
                <span class="lb_topic_count">${t.count}</span>
            </div>
        </div>
      `;
        });

        html += `</div>`;
        detailsContent.html(html);
    }
}