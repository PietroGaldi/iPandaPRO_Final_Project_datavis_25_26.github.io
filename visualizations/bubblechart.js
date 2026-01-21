{
    const width = 1100;
    const chartHeight = 600;

    const colorBg = "#f1f5f9";
    const colorText = "#1e293b";
    const colorSubText = "#64748b";
    const colorIcon = "#0a0a28";
    const colorGray = "#cbd5e1";
    const colorHover = "#ff0007";
    const colorHoverText = "#f59e0b";
    const colorBorder = "#e2e8f0";

    const container = d3.select("#bubblechart");
    container.selectAll("*").remove();

    const mainWrapper = container.append("div")
        .attr("class", "bubblechart_wrapper")
        .style("max-width", `${width}px`)
        .style("margin", "0 auto")
        .style("background", colorBg)
        .style("border-radius", "16px")
        .style("box-shadow", "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)")
        .style("overflow", "visible");

    const header = mainWrapper.append("div")
        .attr("class", "bubblechart_header")
        .style("padding", "24px 32px")
        .style("border-bottom", `1px solid ${colorBorder}`)
        .style("display", "flex")
        .style("flex-wrap", "wrap")
        .style("gap", "20px")
        .style("justify-content", "space-between")
        .style("align-items", "center")
        .style("position", "relative")
        .style("z-index", "20");

    const titleGroup = header.append("div");
    titleGroup.append("div")
        .attr("class", "bubblechart_title")
        .style("font-size", "20px")
        .style("color", "#0f172a")
        .style("letter-spacing", "-0.025em")
        .text("Authors and their publications");

    const subTitle = titleGroup.append("div")
        .attr("class", "bubblechart_text")
        .style("font-size", "14px")
        .style("color", colorSubText)
        .style("margin-top", "6px")
        .style("font-weight", "500")
        .text("Loading data...");

    const controls = header.append("div")
        .attr("class", "bubblechart_control-group")
        .style("display", "flex")
        .style("gap", "12px")
        .style("align-items", "center")
        .style("padding", "6px")
        .style("border-radius", "12px");

    const regionWrapper = controls.append("div")
        .style("display", "flex")
        .style("align-items", "center")
        .style("padding", "0 12px")
        .style("border-right", `1px solid ${colorBorder}`);

    regionWrapper.append("span")
        .attr("class", "bubblechart_text")
        .text("Institution")
        .style("font-size", "11px")
        .style("text-transform", "uppercase")
        .style("letter-spacing", "0.05em")
        .style("font-weight", "700")
        .style("color", "#94a3b8")
        .style("margin-right", "8px");

    const instSelect = regionWrapper.append("select")
        .attr("class", "bubblechart_control-input")
        .style("padding", "8px 12px")
        .style("border", "none")
        .style("background", "transparent")
        .style("font-size", "14px")
        .style("font-weight", "600")
        .style("color", colorText)
        .style("cursor", "pointer")
        .style("max-width", "250px")
        .style("outline", "none");

    const searchWrapper = controls.append("div")
        .attr("class", "net-search-wrapper"); 

    const searchInput = searchWrapper.append("input")
        .attr("class", "bubblechart_control-input") 
        .attr("type", "text")
        .attr("placeholder", "Search person...")
        .style("padding", "8px 12px")
        .style("border", "none")
        .style("background", "transparent")
        .style("font-size", "14px")
        .style("width", "220px")
        .style("outline", "none")
        .style("color", colorText)
        .attr("autocomplete", "off");

    const searchDropdown = searchWrapper.append("div")
        .attr("class", "net-dropdown modern-scroll"); 

    const chartBody = mainWrapper.append("div")
        .attr("id", "chart-body")
        .style("height", `${chartHeight}px`)
        .style("position", "relative")
        .style("background", colorBg)
        .style("z-index", "10")
        .on("click", () => {
            unpinTooltip();
        });

    Promise.all([
        d3.csv("data/openalex_people.csv"),
        d3.csv("data/openalex_works_full.csv")
    ]).then(([peopleData, worksData]) => {

        const worksByPerson = new Map();
        worksData.forEach(work => {
            if (!work.authors) return;
            const authors = work.authors.split(';').map(s => s.trim());
            const workInfo = {
                title: work.title,
                year: work.publication_year
            };
            authors.forEach(name => {
                if (!worksByPerson.has(name)) {
                    worksByPerson.set(name, []);
                }
                worksByPerson.get(name).push(workInfo);
            });
        });

        const allInstitutionsSet = new Set();
        peopleData.forEach(row => {
            row.n_works_in_input = +row.n_works_in_input || 0;
            if (row.institutions) {
                const insts = row.institutions.split(';').map(s => s.trim()).filter(s => s !== "");
                insts.forEach(i => allInstitutionsSet.add(i));
            }
        });
        const sortedInstitutions = Array.from(allInstitutionsSet).sort();
        sortedInstitutions.forEach(inst => {
            instSelect.append("option").text(inst).attr("value", inst);
        });

        const uniqueNames = [...new Set(
            peopleData
                .map(d => (d.display_name_or_alias || "").trim())
                .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b));

        
        searchInput.on("input", function() {
            const val = (this.value || "").toLowerCase().trim();
            
            if (!val) { 
                searchDropdown.classed("open", false).html(""); 
                unpinTooltip();
                applyVisuals(); 
                return; 
            }

            const matches = uniqueNames
                .filter(n => n.toLowerCase().includes(val))
                .slice(0, 50);

            if (matches.length === 0) {
                searchDropdown.classed("open", false);
            } else {
                searchDropdown.classed("open", true);
                
                searchDropdown.selectAll(".net-dd-item")
                    .data(matches)
                    .join("div")
                    .attr("class", "net-dd-item")
                    .text(d => d)
                    .on("click", (e, d) => {
                        e.stopPropagation();
                        searchInput.property("value", d);
                        searchDropdown.classed("open", false);
                        unpinTooltip(); 
                        applyVisuals();
                    });
            }
            
            unpinTooltip();
            applyVisuals();
        });

        d3.select("body").on("click.bubble", () => {
             searchDropdown.classed("open", false);
        });

        searchWrapper.on("click", (e) => e.stopPropagation());


        function updateChart() {
            chartBody.selectAll("svg").remove();
            chartBody.selectAll(".empty-state").remove();

            const selectedInst = instSelect.property("value");
            const allPeople = peopleData;

            function updateSubtitle() {
                const currentInst = instSelect.property("value");
                const highlightedCount = allPeople.filter(d => (d.institutions || "").includes(currentInst)).length;
                subTitle.text(`${highlightedCount} people in ${currentInst}`);
            }
            updateSubtitle();

            const svg = chartBody.append("svg")
                .attr("width", width)
                .attr("height", chartHeight)
                .style("display", "block")
                .style("margin", "0 auto");

            const root = d3.hierarchy({ children: allPeople })
                .sum(d => d.n_works_in_input)
                .sort((a, b) => b.value - a.value);

            const pack = d3.pack()
                .size([width, chartHeight])
                .padding(3);

            const nodes = pack(root).leaves();

            const bubbles = svg.selectAll("circle")
                .data(nodes)
                .enter()
                .append("circle")
                .attr("cx", d => d.x)
                .attr("cy", d => d.y)
                .attr("r", d => d.r)
                .style("cursor", "pointer")
                .style("transition", "fill 0.4s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.4s ease");

            if (nodes.length > 0) {
                 const maxNode = nodes[0];
                 const k = maxNode.r / Math.sqrt(maxNode.value);
                 const maxVal = Math.ceil(maxNode.value);
                 const midVal = Math.round(maxVal / 2);
                 const minVal = Math.max(1, Math.round(d3.min(nodes, d => d.value)));
                 const legendValues = [minVal, midVal, maxVal];
                 const uniqueValues = [...new Set(legendValues)].sort((a, b) => a - b);
                 const legendGroup = svg.append("g")
                    .attr("class", "bubblechart_legend")
                    .attr("transform", `translate(30, 30)`);
                 const legendWidth = uniqueValues.length * 50 + 40;
                 legendGroup.append("rect")
                    .attr("x", -10).attr("y", -20).attr("width", legendWidth).attr("height", 95).attr("rx", 8)
                    .style("fill", "rgba(255, 255, 255, 0.6)").style("backdrop-filter", "blur(4px)");
                 legendGroup.append("text")
                    .attr("x", 0).attr("y", -5).style("font-size", "11px").style("fill", "#64748b")
                    .style("font-weight", "700").style("text-transform", "uppercase").text("Publications Count");
                 let currentX = 10;
                 uniqueValues.forEach((val) => {
                    const r = k * Math.sqrt(val);
                    const diameter = r * 2;
                    const bubbleCenterY = 25;
                    legendGroup.append("circle").attr("cx", currentX + r).attr("cy", bubbleCenterY).attr("r", r).style("fill", "#0f172a");
                    legendGroup.append("text").attr("x", currentX + r).attr("y", bubbleCenterY + r + 14).style("text-anchor", "middle")
                        .style("font-size", "11px").style("fill", "#475569").style("font-weight", "600").text(val);
                    currentX += diameter + 25;
                 });
            }

            window.applyVisuals = function() {
                const searchTerm = searchInput.property("value").toLowerCase().trim();
                const currentInst = instSelect.property("value");

                bubbles.each(function (d) {
                    const circle = d3.select(this);
                    const name = (d.data.display_name_or_alias || "").toLowerCase();
                    const personInsts = (d.data.institutions || "");

                    const isMember = personInsts.includes(currentInst);
                    let fillColor = isMember ? colorIcon : colorGray;
                    let opacity = 1;

                    if (searchTerm) {
                        if (name.includes(searchTerm)) {
                            fillColor = colorHover;
                            opacity = 1;
                        } else {
                            opacity = 0.1;
                        }
                    }
                    circle.style("fill", fillColor).style("opacity", opacity);
                });
            }
            window.applyVisuals();

            let pinnedNode = null;

            bubbles
                .on("mouseenter", (event, d) => {
                    if (pinnedNode) return;
                    const circle = d3.select(event.currentTarget);
                    if (circle.style("opacity") > 0.2) {
                        circle.style("fill", colorHover);
                    }
                    showTooltip(event, d);
                })
                .on("mousemove", (event) => {
                    if (pinnedNode) return;
                    updateTooltipPos(event);
                })
                .on("mouseleave", (event) => {
                    if (pinnedNode) return;
                    window.applyVisuals();
                    tooltip.style("opacity", 0).style("pointer-events", "none");
                })
                .on("click", (event, d) => {
                    event.stopPropagation();
                    if (pinnedNode === d) {
                        unpinTooltip();
                    } else {
                        pinnedNode = d;
                        window.applyVisuals();
                        d3.select(event.currentTarget).style("fill", colorHover).style("opacity", 1);
                        showTooltip(event, d);
                        tooltip.style("pointer-events", "auto");

                        tooltip.select(".bubblechart_close-hint").remove();
                        tooltip.append("div")
                            .attr("class", "bubblechart_close-hint")
                            .style("text-align", "center")
                            .style("font-size", "10px")
                            .style("color", "#94a3b8")
                            .style("margin-top", "8px")
                            .style("cursor", "pointer")
                            .text("Click anywhere to close");
                    }
                });

            function showTooltip(event, d) {
                const personName = d.data.display_name_or_alias;
                const works = worksByPerson.get(personName) || [];
                works.sort((a, b) => b.year - a.year);
                const instList = (d.data.institutions || "").split(';').map(s => s.trim()).join('<br>');

                let worksHtml = "";
                if (works.length > 0) {
                    worksHtml = `
                    <div style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.2); max-height:200px; overflow-y:auto;" class="bubblechart_scroll">
                        <div style="font-size:10px; text-transform:uppercase; color:#94a3b8; margin-bottom:4px; font-weight:700;">Publications</div>
                        ${works.map(w => `
                            <div style="margin-bottom:6px; font-size:11px; line-height:1.3; display:flex; gap:6px;">
                                <span style="color:#f59e0b; font-weight:700; flex-shrink:0;">${w.year}</span>
                                <span>${w.title}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
                } else {
                    worksHtml = `<div style="margin-top:8px; font-style:italic; font-size:11px; opacity:0.7;">No linked publications.</div>`;
                }

                tooltip.html(`
                <div style="font-weight:600; font-size:14px; color:${colorHoverText}; padding-right:10px;">${personName}</div>
                <div style="font-size:11px; color:#cbd5e1; margin-top:4px; line-height:1.3; max-height:60px; overflow-y:auto;" class="bubblechart_scroll">
                    ${instList}
                </div> 
                <div style="margin-top:6px; font-size:12px;">
                    Total: <strong>${d.data.n_works_in_input}</strong> works
                </div>
                ${worksHtml}
            `);

                tooltip.style("opacity", 1);
                if (!pinnedNode) updateTooltipPos(event);
            }

            function updateTooltipPos(event) {
                const tooltipNode = tooltip.node();
                const tooltipRect = tooltipNode.getBoundingClientRect();
                const windowHeight = window.innerHeight;
                const potentialBottom = event.pageY + 20 + tooltipRect.height;
                let topPos = event.pageY + 20;
                let leftPos = event.pageX + 15;
                if (potentialBottom > windowHeight + window.scrollY) {
                    topPos = event.pageY - tooltipRect.height - 20;
                }
                tooltip.style("left", leftPos + "px").style("top", topPos + "px");
            }

            window.unpinTooltip = function () {
                pinnedNode = null;
                tooltip.style("opacity", 0).style("pointer-events", "none");
                window.applyVisuals();
            };

            instSelect.on("change", () => {
                window.unpinTooltip();
                updateSubtitle();
                window.applyVisuals();
            });
        }

        const tooltip = d3.select(".bubblechart_tooltip").empty()
            ? d3.select("body").append("div").attr("class", "bubblechart_tooltip")
            : d3.select(".bubblechart_tooltip");

        tooltip
            .style("position", "absolute")
            .style("opacity", 0)
            .style("z-index", 1000)
            .style("max-width", "350px")
            .style("pointer-events", "none");

        instSelect.property("value", "University of Genoa");
        updateChart();

    }).catch(err => {
        console.error(err);
        chartBody.html(`<div style="color:red; padding:40px; text-align:center;">Error loading data.<br>Check console for details.</div>`);
    });
}