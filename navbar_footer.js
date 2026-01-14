document.addEventListener("DOMContentLoaded", function() {
    const navbarHTML = `
    <nav class="sidebar" id="mySidebar">
        <div class="sidebar_header" id="toggleHeader">
            <img src="imgs/glogo.svg" alt="group_logo" class="group_logo">
        </div>
        
        <div class="nav-links-container">
            <a href="index.html" class="nav-item"><i class="fa-solid fa-house"></i> The RAISE Project</a>
            <a href="people.html" class="nav-item"><i class="fa-solid fa-people-arrows"></i> People</a>
            <a href="institutions.html" class="nav-item"><i class="fa-solid fa-building-columns"></i> Institutions</a>
            <a href="collaborations.html" class="nav-item"><i class="fa-solid fa-hexagon-nodes"></i> Collaborations</a>
            <a href="methodology.html" class="nav-item"><i class="fa-solid fa-database"></i> Methodology </a>
        </div>
    </nav>`;

    document.querySelector(".main_area").insertAdjacentHTML("afterbegin", navbarHTML);

    const currentPath = window.location.pathname.split("/").pop();
    const navLinks = document.querySelectorAll(".nav-item");
    
    navLinks.forEach(link => {
        const linkPath = link.getAttribute("href");
        if (linkPath === currentPath || (currentPath === "" && linkPath === "index.html")) {
            link.style.backgroundColor = "#ffffff";
            link.style.color = "#ff0007";
        }
    });

    const header = document.getElementById("toggleHeader");
    const sidebar = document.getElementById("mySidebar");

    if (currentPath === "index.html" || currentPath === "") {
        sidebar.classList.add("collapsed");
    }

    header.addEventListener("click", function() {
        sidebar.classList.toggle("collapsed");
    });

});

document.addEventListener("DOMContentLoaded", function() {
    const footerHTML = `
    <footer>
            <p>University of Genova: Data Visualization Final Project 2025/2026</p>
            <p>Group: iPanda PRO</p>
            <p>Mapping the RAISE ecosystem</p>
    </footer>
    `;

    document.body.insertAdjacentHTML('beforeend', footerHTML);
});