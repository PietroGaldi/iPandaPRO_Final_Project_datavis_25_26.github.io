# iPandaPRO_Final_Project_datavis_25_26.github.io

### Preprocessing: 
To create the openalex_people.csv and institutions_osm_coords.csv run the .ipynb notebooks contained in the data folder. 
The majority of the preprocessing was handled inside the .js files of the visualizations.

### Server building:
To launch locally the server, the following python command must be runned

```python -m http.server 8000``` 

Once running, navigate to http://localhost:8000 in the web browser.

### Folder structure:
Root: HTML/CSS framework and nav_footer.js to handle the navbar and the footer.

/data: CSV data sources and preprocessing Notebooks.

/visualizations: D3.js scripts for the charts.

/imgs: Static image logo used in the navbar.
