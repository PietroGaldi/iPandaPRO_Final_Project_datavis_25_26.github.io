document.addEventListener("DOMContentLoaded", function() {
    const navbarHTML = `
    <nav class="sidebar" id="mySidebar">
        <div class="sidebar_header" id="toggleHeader">
            <img src="imgs/glogo.svg" alt="group_logo" class="group_logo">
        </div>
        
        <div class="nav-links-container">
            <a href="index.html" class="nav-item"><i class="fa-solid fa-house"></i> The RAISE Project</a>
            <a href="#" class="nav-item"><i class="fa-solid fa-chart-line"></i> People</a>
            <a href="#" class="nav-item"><i class="fa-solid fa-users"></i> Institutions</a>
            <a href="#" class="nav-item"><i class="fa-solid fa-circle-info"></i> Collaborations</a>
        </div>
    </nav>`;

    document.querySelector(".main_area").insertAdjacentHTML("afterbegin", navbarHTML);

    const currentPath = window.location.pathname.split("/").pop();
    const navLinks = document.querySelectorAll(".nav-item");
    
    navLinks.forEach(link => {
        const linkPath = link.getAttribute("href");
        if (linkPath === currentPath || (currentPath === "" && linkPath === "home.html")) {
            link.style.backgroundColor = "#34495e";
            link.style.color = "#ffffff";
        }
    });

    const header = document.getElementById("toggleHeader");
    const sidebar = document.getElementById("mySidebar");

    header.addEventListener("click", function() {
        sidebar.classList.toggle("collapsed");
    });

});