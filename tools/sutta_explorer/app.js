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

function normalizeSearchText(text) {
    return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

function searchTerms() {
    const query = normalizeSearchText(queryInput.value.trim());
    const terms = [];
    for (const match of query.matchAll(/[“"]([^”"]+)[”"]|\S+/g)) {
        const term = (match[1] || match[0]).trim();
        if (term) terms.push(term);
    }
    return terms;
}

function highlightedElement(tag, text, terms, className) {
    const node = element(tag, undefined, className);
    if (!terms.length) {
        node.textContent = text;
        return node;
    }
    const units = [];
    let offset = 0;
    for (const character of text) {
        const end = offset + character.length;
        if (/\p{M}/u.test(character) && units.length) {
            units.at(-1).text += character;
            units.at(-1).end = end;
        } else {
            units.push({text: character, start: offset, end});
        }
        offset = end;
    }
    const normalized = units.map(unit => normalizeSearchText(unit.text)).join("");
    const positions = units.flatMap(unit => [...normalizeSearchText(unit.text)].map(() => unit));
    const ranges = [];
    for (const term of terms) {
        let start = 0;
        while ((start = normalized.indexOf(term, start)) >= 0) {
            ranges.push({start: positions[start].start, end: positions[start + term.length - 1].end});
            start += term.length;
        }
    }
    ranges.sort((first, second) => first.start - second.start || first.end - second.end);
    const merged = ranges.reduce((result, range) => {
        const previous = result.at(-1);
        if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
        else result.push(range);
        return result;
    }, []);
    let cursor = 0;
    for (const range of merged) {
        node.append(document.createTextNode(text.slice(cursor, range.start)));
        node.append(element("mark", text.slice(range.start, range.end)));
        cursor = range.end;
    }
    node.append(document.createTextNode(text.slice(cursor)));
    return node;
}

function resultItem(index) {
    const sutta = suttas[index];
    const terms = searchTerms();
    const item = element("li");
    const button = element("button", undefined, "sutta");
    button.type = "button";
    button.dataset.index = index;
    button.setAttribute("aria-pressed", String(index === selected));
    button.append(highlightedElement("strong", sutta.uid, terms));
    if (sutta.title) button.append(highlightedElement("span", sutta.title, terms, "title"));
    button.append(highlightedElement("span", sutta.blurb, terms));
    const visibleText = normalizeSearchText([sutta.uid, sutta.title, sutta.blurb].join(" "));
    const hiddenTerms = terms.filter(term => !visibleText.includes(term));
    const matchingAliases = (sutta.aliases || []).filter(alias => hiddenTerms.some(term => normalizeSearchText(alias).includes(term)));
    if (matchingAliases.length) {
        button.append(highlightedElement("span", "Also known as: " + matchingAliases.join(", "), terms, "aliases"));
    }
    button.addEventListener("click", () => selectSutta(index, true));
    item.append(button);
    return item;
}

function selectSutta(index, focusDetails = false) {
    selected = index;
    const sutta = suttas[index];
    const terms = searchTerms();
    const link = element("a", "Read on SuttaCentral", "read");
    link.href = sutta.url || "https://suttacentral.net/" + encodeURIComponent(sutta.uid);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const neighbors = element("ul");
    neighbors.id = "neighbors";
    sutta.neighbors.forEach(neighbor => neighbors.append(resultItem(neighbor)));
    details.replaceChildren(highlightedElement("h1", sutta.title || sutta.uid, terms), element("div", sutta.uid.toUpperCase() + " · " + sutta.book.toUpperCase() + " · Cluster " + sutta.cluster, "meta"), highlightedElement("p", sutta.blurb, terms), link, element("h2", "Similar blurbs"), neighbors);
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
    const query = normalizeSearchText(queryInput.value.trim());
    const terms = searchTerms();
    matching = suttas.map((_, index) => index).filter(index => {
        const sutta = suttas[index];
        const searchable = normalizeSearchText([sutta.uid, sutta.title, sutta.blurb, ...(sutta.aliases || [])].join(" "));
        return (!collection.value || sutta.book === collection.value) && terms.every(term => searchable.includes(term));
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
        const palette = ["#66c292", "#e27958", "#7399e8", "#d5a83f", "#bc7fc1", "#4bbcc0", "#9caf56", "#de7184", "#91a0b5", "#c49a72"];
        const traces = [{
            type: "scattergl", mode: "markers",
            x: matching.map(index => suttas[index].x), y: matching.map(index => suttas[index].y),
            customdata: matching, text: matching.map(index => [suttas[index].uid, suttas[index].title].filter(Boolean).join(" · ")), hovertemplate: "%{text}<extra></extra>",
            marker: {size: 7, opacity: 0.7, color: matching.map(index => palette[Number(suttas[index].cluster) % palette.length])}
        }];
        if (selected >= 0) traces.push({type: "scattergl", mode: "markers", x: [suttas[selected].x], y: [suttas[selected].y], customdata: [selected], text: [suttas[selected].uid], hovertemplate: "%{text}<extra></extra>", marker: {size: 16, color: "#f1eee7", symbol: "circle-open", line: {width: 3}}});
        await Plotly.react("map", traces, {margin: {t: 12, b: 12, l: 12, r: 12}, showlegend: false, dragmode: "pan", uirevision: "suttas", paper_bgcolor: "#171918", plot_bgcolor: "#171918", font: {color: "#f1eee7"}, xaxis: {visible: false}, yaxis: {visible: false}}, {responsive: true, displaylogo: false, scrollZoom: false, modeBarButtonsToRemove: ["select2d", "lasso2d", "toImage"]});
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
for (const name of ["map", "list"]) {
    const tab = document.getElementById(name + "-tab");
    tab.addEventListener("click", () => setView(name === "map"));
    tab.addEventListener("keydown", event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const showMap = event.key === "Home" || (event.key !== "End" && !mapVisible);
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
setView(true);
if (!suttas.length) status.textContent = "Data unavailable. Run the explorer builder first.";