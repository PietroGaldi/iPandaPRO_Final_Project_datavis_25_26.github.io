const width = 1100;
const chartHeight = 600; 

const colorBg = "#f1f5f9";       
const colorCard = "#ffffff";     
const colorText = "#1e293b";     
const colorSubText = "#64748b";  
const colorIcon = "#0a0a28";     
const colorHover = "#ff0007";    
const colorHoverText = "#f59e0b";
const colorBorder = "#e2e8f0";   

const iconClass = "fa-solid fa-person";

const territories = {
    "World": null,
    "Italy": ["IT"],
    "Europe": ["IT", "FR", "DE", "GB", "ES", "NL", "PL", "DK", "FI", "SE", "NO", "CZ", "AT", "RE", "BE", "CH", "IE", "PT", "GR"],
    "Asia": ["CN", "JP", "KR", "VN", "PK", "AE", "ID", "TH", "SG", "IN"],
    "USA": ["US"]
};

const container = d3.select("#pictorial");
container.selectAll("*").remove();

const mainWrapper = container.append("div")
    .style("max-width", `${width}px`)
    .style("margin", "0 auto")
    .style("font-family", "'Fira Sans', system-ui, -apple-system, sans-serif")
    .style("background", colorBg)
    .style("border-radius", "16px")
    .style("box-shadow", "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)")
    .style("overflow", "visible"); 

const header = mainWrapper.append("div")
    .style("background", "white")
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
    .style("font-family", "'Roboto Slab', sans-serif")
    .style("font-size", "20px")
    .style("font-weight", "700")
    .style("color", "#0f172a")
    .style("letter-spacing", "-0.025em")
    .text("Researchers involved in RAISE");

const subTitle = titleGroup.append("div")
    .style("font-size", "14px")
    .style("color", colorSubText)
    .style("margin-top", "6px")
    .style("font-weight", "500")
    .text("Loading data...");

const controls = header.append("div")
    .style("display", "flex")
    .style("gap", "12px")
    .style("align-items", "center")
    .style("background", "#f8fafc")
    .style("padding", "6px")
    .style("border-radius", "12px")
    .style("border", `1px solid ${colorBorder}`);

const regionWrapper = controls.append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("padding", "0 12px")
    .style("border-right", `1px solid ${colorBorder}`);

regionWrapper.append("span")
    .text("Location")
    .style("font-size", "12px")
    .style("text-transform", "uppercase")
    .style("letter-spacing", "0.05em")
    .style("font-weight", "700")
    .style("color", "#94a3b8")
    .style("margin-right", "8px");

const regionSelect = regionWrapper.append("select")
    .attr("class", "control-input")
    .style("padding", "6px 2px")
    .style("border", "none")
    .style("background", "transparent")
    .style("font-family", "'Fira Sans', sans-serif")
    .style("font-size", "14px")
    .style("font-weight", "600")
    .style("color", colorText)
    .style("cursor", "pointer")
    .style("outline", "none");

Object.keys(territories).forEach(key => {
    regionSelect.append("option").text(key).attr("value", key);
});

const searchWrapper = controls.append("div")
    .attr("class", "net-search-wrapper")
    .style("text-align", "left"); 

const searchInput = searchWrapper.append("input")
    .attr("class", "control-input")
    .attr("type", "text")
    .attr("placeholder", "Search person...")
    .style("padding", "8px 12px")
    .style("border", "none")
    .style("background", "transparent")
    .style("font-family", "'Fira Sans', sans-serif")
    .style("font-size", "14px")
    .style("width", "200px")
    .style("outline", "none")
    .style("color", colorText)
    .attr("autocomplete", "off");

const searchDropdown = searchWrapper.append("div")
    .attr("class", "net-dropdown modern-scroll")
    .style("text-align", "left"); 

const chartBody = mainWrapper.append("div")
    .attr("id", "chart-body")
    .attr("class", "modern-scroll")
    .style("height", `${chartHeight}px`) 
    .style("overflow-y", "auto")         
    .style("padding", "32px")
    .style("display", "grid")
    .style("grid-template-columns", "repeat(auto-fill, minmax(320px, 1fr))")
    .style("gap", "20px")
    .style("align-content", "start")
    .style("z-index", "10");   


Promise.all([
    d3.csv("data/openalex_people.csv"),
    d3.csv("data/institutions_osm_coords.csv")
]).then(([peopleData, geoData]) => {

    const countryMap = new Map();
    geoData.forEach(d => {
        if (d.display_name && d.country_code) {
            countryMap.set(d.display_name.trim(), d.country_code.trim());
        }
    });

    const instMap = new Map();

    peopleData.forEach(row => {
        let uniqueInsts = [];

        if (row.institutions) {
            const insts = row.institutions.split(';').map(s => s.trim()).filter(s => s !== "");
            uniqueInsts = [...new Set(insts)];
        }

        if (uniqueInsts.length === 0) {
            uniqueInsts = ["No Affiliation"];
        }

        const personName = row.display_name_or_alias || "Unknown";

        uniqueInsts.forEach(instName => {
            if (!instMap.has(instName)) {
                instMap.set(instName, {
                    name: instName,
                    people: [], 
                    country: countryMap.get(instName) || "Other"
                });
            }
            instMap.get(instName).people.push(personName);
        });
    });

    const allInstitutions = Array.from(instMap.values())
        .sort((a, b) => b.people.length - a.people.length);

    const allNames = [...new Set(peopleData.map(d => (d.display_name_or_alias || "").trim()).filter(Boolean))].sort();

    function updateChart() {
        chartBody.html("");

        const regionKey = regionSelect.property("value");
        const searchTerm = searchInput.property("value").toLowerCase();
        
        const allowedCodes = territories[regionKey];
        let filteredData = allInstitutions.filter(d => {
            if (allowedCodes === null) return true;
            return allowedCodes.includes(d.country);
        });

        if (searchTerm) {
            filteredData = filteredData.filter(inst => 
                inst.people.some(person => person.toLowerCase().includes(searchTerm))
            );
        }

        const uniquePeople = new Set();
        filteredData.forEach(inst => {
            inst.people.forEach(person => uniquePeople.add(person));
        });
        subTitle.text(`${filteredData.length} Institutions - ${uniquePeople.size} Researchers`);

        if (filteredData.length === 0) {
            chartBody
                .style("display", "flex")
                .style("justify-content", "center")
                .style("align-items", "center")
                .style("height", "100%"); 
            
            chartBody.append("div")
                .style("color", colorSubText)
                .style("text-align", "center")
                .style("background", "white")
                .style("padding", "40px")
                .style("border-radius", "16px")
                .style("box-shadow", "0 4px 6px -1px rgba(0, 0, 0, 0.05)")
                .html(`
                    <i class="fa-solid fa-magnifying-glass" style="font-size: 24px; margin-bottom: 10px; color: #cbd5e1;"></i><br>
                    No matches found for <strong>${regionKey}</strong>
                `);
            return;
        } 
        
        chartBody.style("display", "grid");

        const cards = chartBody.selectAll(".inst-card")
            .data(filteredData, d => d.name);

        const cardsEnter = cards.enter().append("div")
            .attr("class", "inst-card fade-in")
            .style("background", colorCard)
            .style("border", `1px solid ${colorBorder}`) 
            .style("border-radius", "12px")
            .style("padding", "20px")
            .style("display", "flex")
            .style("flex-direction", "column")
            .style("gap", "12px")
            .style("box-shadow", "0 1px 2px 0 rgba(0, 0, 0, 0.05)")
            .style("transition", "all 0.2s ease"); 

        const cardHeader = cardsEnter.append("div")
            .style("display", "flex")
            .style("justify-content", "space-between")
            .style("align-items", "flex-start")
            .style("border-bottom", `1px solid ${colorBorder}`)
            .style("padding-bottom", "12px")
            .style("margin-bottom", "4px");

        cardHeader.append("div")
            .style("font-weight", "600")
            .style("font-size", "15px")
            .style("color", colorText)
            .style("line-height", "1.4")
            .text(d => d.name);

        cardHeader.append("div")
            .style("background", "#f1f5f9") 
            .style("color", "#64748b")
            .style("font-size", "12px")
            .style("font-weight", "700")
            .style("padding", "4px 10px")
            .style("border-radius", "20px")
            .style("white-space", "nowrap")
            .text(d => d.people.length);

        const iconsArea = cardsEnter.append("div")
            .style("display", "flex")
            .style("flex-wrap", "wrap")
            .style("gap", "6px"); 

        iconsArea.each(function(d) {
            const sel = d3.select(this);
            
            sel.selectAll("i")
                .data(d.people.map(p => ({ name: p, inst: d.name })))
                .enter()
                .append("i")
                .attr("class", iconClass)
                .style("font-size", "15px")
                .style("cursor", "pointer")
                .style("transition", "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), color 0.2s")
                .style("color", p => {
                    if (searchTerm && p.name.toLowerCase().includes(searchTerm)) return colorHover;
                    if (searchTerm) return "#cbd5e1"; 
                    return colorIcon;
                })
                .style("transform", p => {
                    if (searchTerm && p.name.toLowerCase().includes(searchTerm)) return "scale(1.2)";
                    return "scale(1)";
                });
        });

        const cardsUpdate = cardsEnter.merge(cards);
        attachInteractions(cardsUpdate);
    }

    searchInput.on("input", function() {
        const val = this.value.toLowerCase().trim();
        updateChart();

        if (!val) { 
            searchDropdown.classed("open", false).html(""); 
            return; 
        }

        const matches = allNames
            .filter(n => n.toLowerCase().includes(val));

        if (matches.length === 0) {
            searchDropdown.classed("open", false);
        } else {
            searchDropdown.classed("open", true);
            searchDropdown.selectAll(".net-dd-item")
                .data(matches)
                .join("div")
                .attr("class", "net-dd-item") 
                .style("text-align", "left") // Force align items left
                .text(d => d)
                .on("click", (e, d) => {
                    e.stopPropagation();
                    searchInput.property("value", d);
                    searchDropdown.classed("open", false);
                    updateChart();
                });
        }
    });

    d3.select("body").on("click.pictorial", () => {
         searchDropdown.classed("open", false);
    });
    
    searchWrapper.on("click", (e) => e.stopPropagation());

    const tooltip = d3.select(".pictorial-tooltip").empty() 
        ? d3.select("body").append("div").attr("class", "pictorial-tooltip")
        : d3.select(".pictorial-tooltip");
    
    tooltip
        .style("position", "absolute")
        .style("background", "rgba(15, 23, 42, 0.95)")
        .style("backdrop-filter", "blur(8px)")
        .style("color", "white")
        .style("padding", "8px 12px")
        .style("border-radius", "8px")
        .style("font-family", "'Fira Sans', sans-serif")
        .style("font-size", "12px")
        .style("box-shadow", "0 10px 15px -3px rgba(0, 0, 0, 0.3)")
        .style("pointer-events", "none")
        .style("opacity", 0)
        .style("z-index", 1000)
        .style("border", "1px solid rgba(255,255,255,0.1)");

    function attachInteractions(selection) {
        selection.selectAll("i")
            .on("mouseenter", (event, d) => {
                const icon = d3.select(event.target);
                icon.style("color", colorHover).style("transform", "scale(1.4)");
                
                tooltip.transition().duration(100).style("opacity", 1);
                tooltip.html(`<div style="font-weight:600; color:${colorHoverText}">${d.name}</div>`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 20) + "px");
            })
            .on("mouseleave", (event, d) => {
                const searchTerm = searchInput.property("value").toLowerCase();
                const isMatch = searchTerm && d.name.toLowerCase().includes(searchTerm);

                d3.select(event.target)
                    .style("color", isMatch ? colorHover : (searchTerm ? "#cbd5e1" : colorIcon))
                    .style("transform", isMatch ? "scale(1.2)" : "scale(1)");
                
                tooltip.transition().duration(200).style("opacity", 0);
            });
    }

    regionSelect.on("change", updateChart);

    regionSelect.property("value", "Italy");
    updateChart();

}).catch(err => {
    console.error(err);
    container.html(`<div style="color:red; padding:20px;">Error loading data.</div>`);
});