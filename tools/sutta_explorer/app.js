"use strict";

const suttas = window.SUTTAS || [];
const queryInput = document.getElementById("query");
const collection = document.getElementById("collection");
const results = document.getElementById("results");
const details = document.getElementById("details");
const status = document.getElementById("status");
const more = document.getElementById("more");
const mapStatus = document.getElementById("map-status");
let matching = suttas.map((_, index) => index);
let limit = 40;
let selected = -1;
let mapVisible = false;
let plotlyPromise;
let mapReady = false;
let mapRevision = 0;

function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
}

function resultItem(index) {
    const sutta = suttas[index];
    const item = element("li");
    const button = element("button", undefined, "sutta");
    button.type = "button";
    button.dataset.index = index;
    button.setAttribute("aria-pressed", String(index === selected));
    button.append(element("strong", sutta.uid), element("span", sutta.blurb));
    button.addEventListener("click", () => selectSutta(index, true));
    item.append(button);
    return item;
}

function selectSutta(index, focusDetails = false) {
    selected = index;
    const sutta = suttas[index];
    const link = element("a", "Read on SuttaCentral", "read");
    link.href = sutta.url || "https://suttacentral.net/" + encodeURIComponent(sutta.uid);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const neighbors = element("ul");
    neighbors.id = "neighbors";
    sutta.neighbors.forEach(neighbor => neighbors.append(resultItem(neighbor)));
    details.replaceChildren(element("h1", sutta.uid), element("div", sutta.book.toUpperCase() + " · Cluster " + sutta.cluster, "meta"), element("p", sutta.blurb), link, element("h2", "Similar blurbs"), neighbors);
    document.querySelectorAll(".sutta").forEach(button => button.setAttribute("aria-pressed", String(Number(button.dataset.index) === selected)));
    history.replaceState(null, "", "#" + encodeURIComponent(sutta.uid));
    if (mapReady) updateMap();
    if (focusDetails) details.focus({preventScroll: true});
    if (focusDetails && matchMedia("(max-width: 720px)").matches) details.scrollIntoView({block: "start"});
}

function renderResults() {
    results.replaceChildren(...matching.slice(0, limit).map(resultItem));
    if (!matching.length) results.append(element("li", "No matching suttas", "empty"));
    more.hidden = limit >= matching.length;
    status.textContent = matching.length + (matching.length === 1 ? " sutta" : " suttas");
}

function filter() {
    const query = queryInput.value.trim().toLowerCase();
    matching = suttas.map((_, index) => index).filter(index => {
        const sutta = suttas[index];
        return (!collection.value || sutta.book === collection.value) && (sutta.uid + " " + sutta.blurb).toLowerCase().includes(query);
    });
    matching.sort((first, second) => Number(suttas[second].uid === query) - Number(suttas[first].uid === query));
    limit = 40;
    renderResults();
    if (mapVisible) updateMap();
}

function loadPlotly() {
    if (!plotlyPromise) {
        plotlyPromise = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://cdn.plot.ly/plotly-3.7.0.min.js";
            script.onload = resolve;
            script.onerror = () => reject(new Error("Map unavailable. List and similar blurbs remain available."));
            document.head.append(script);
        }).catch(error => { plotlyPromise = undefined; throw error; });
    }
    return plotlyPromise;
}

async function updateMap() {
    const revision = ++mapRevision;
    mapStatus.textContent = "Loading map…";
    try {
        await loadPlotly();
        if (revision !== mapRevision || !mapVisible) return;
        const palette = ["#236c50", "#ba5835", "#466ab2", "#b08016", "#925484", "#25858a", "#646f35", "#ac4657", "#576171", "#786044"];
        const traces = [{
            type: "scattergl", mode: "markers",
            x: matching.map(index => suttas[index].x), y: matching.map(index => suttas[index].y),
            customdata: matching, text: matching.map(index => suttas[index].uid), hovertemplate: "%{text}<extra></extra>",
            marker: {size: 7, opacity: 0.7, color: matching.map(index => palette[Number(suttas[index].cluster) % palette.length])}
        }];
        if (selected >= 0) traces.push({type: "scattergl", mode: "markers", x: [suttas[selected].x], y: [suttas[selected].y], customdata: [selected], text: [suttas[selected].uid], hovertemplate: "%{text}<extra></extra>", marker: {size: 16, color: "#20332c", symbol: "circle-open", line: {width: 3}}});
        await Plotly.react("map", traces, {margin: {t: 12, b: 12, l: 12, r: 12}, showlegend: false, dragmode: "pan", uirevision: "suttas", paper_bgcolor: "#fcfdfc", plot_bgcolor: "#fcfdfc", xaxis: {visible: false}, yaxis: {visible: false}}, {responsive: true, displaylogo: false, scrollZoom: false, modeBarButtonsToRemove: ["select2d", "lasso2d", "toImage"]});
        if (!mapReady) document.getElementById("map").on("plotly_click", event => selectSutta(event.points[0].customdata, true));
        mapReady = true;
        mapStatus.textContent = "";
    } catch (error) {
        mapStatus.textContent = error.message;
    }
}

function setView(showMap) {
    mapVisible = showMap;
    document.getElementById("map-panel").hidden = !showMap;
    document.getElementById("list-panel").hidden = showMap;
    for (const name of ["list", "map"]) {
        const tab = document.getElementById(name + "-tab");
        const active = (name === "map") === showMap;
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
    }
    if (showMap) updateMap();
}

for (const book of [...new Set(suttas.map(sutta => sutta.book))].sort()) {
    const option = element("option", book.toUpperCase());
    option.value = book;
    collection.append(option);
}
for (const name of ["list", "map"]) {
    const tab = document.getElementById(name + "-tab");
    tab.addEventListener("click", () => setView(name === "map"));
    tab.addEventListener("keydown", event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const showMap = event.key === "End" || (event.key !== "Home" && !mapVisible);
        setView(showMap);
        document.getElementById(showMap ? "map-tab" : "list-tab").focus();
    });
}
queryInput.addEventListener("input", filter);
collection.addEventListener("change", filter);
more.addEventListener("click", () => { limit += 40; renderResults(); });
document.getElementById("total").textContent = suttas.length + " suttas · English blurbs";
renderResults();
const initial = suttas.findIndex(sutta => "#" + encodeURIComponent(sutta.uid) === location.hash);
if (initial >= 0) selectSutta(initial);
if (!suttas.length) status.textContent = "Data unavailable. Run the explorer builder first.";