(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const input = $("query");
  const status = $("status");
  const direction = $("direction");
  const partial = $("partial");
  const parameters = new URLSearchParams(location.search);
  direction.value = parameters.get("direction") === "pli-en" ? "pli-en" : "en-pli";
  partial.checked = parameters.get("partial") !== "0";
  if (!globalThis.PALI_DICTIONARY || !globalThis.PaliSearch) {
    status.textContent = "Dictionary data is missing. Run: python3 browser_dictionary/build.py — then reload this page.";
    return;
  }

  let dictionary;
  try {
    dictionary = new PaliSearch.Dictionary(PALI_DICTIONARY);
  } catch (error) {
    status.textContent = `Could not load the dictionary: ${error.message}. Rebuild data.js and reload.`;
    return;
  }
  let current;
  let visible = 0;
  let timer;
  const PAGE_SIZE = 30;
  const sourceNames = Object.keys(PALI_DICTIONARY.sources);
  $("sources").textContent = `Included sources: ${sourceNames.join(", ")}. Original meanings and Pāli spelling are preserved; source markup is removed. Cross-reference-only records are omitted. DPD, when included, uses distinct lemma senses with explicitly marked English meanings.`;
  $("metadata").textContent = `${dictionary.entries.length.toLocaleString("en")} dictionary senses · ${sourceNames.join(" + ")} · Local search`;
  input.disabled = false;
  direction.disabled = false;
  partial.disabled = false;
  $("search-button").disabled = false;
  $("examples").hidden = false;

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function updateDirection() {
    const pali = direction.value === "pli-en";
    $("diacritics-toggle").hidden = !pali;
    $("diacritics-toggle").setAttribute("aria-expanded", "false");
    $("diacritics").hidden = true;
    $("query-label").textContent = pali ? "Pāli word or phrase" : "English word or phrase";
    input.lang = pali ? "pi" : "en";
    input.placeholder = pali ? "Try mettā, sati, or karuna" : "Try compassion, peace, or mindfulness";
    $("search-help").textContent = pali
      ? "Diacritics are optional. Open Diacritics for character buttons; matching diacritics rank higher."
      : "Spelling suggestions show the English term used. They are not synonyms.";
    $("suggestions").setAttribute("aria-label", `${pali ? "Pāli" : "English"} spelling suggestions`);
    $("examples").replaceChildren(element("span", "Try:"));
    for (const [query, label] of pali
      ? [["mettā", "mettā"], ["karuna", "karuna (no diacritics)"], ["mettta", "mettta (typo)"]]
      : [["compassion", "compassion"], ["peace", "peace"], ["mindfullness", "mindfullness (typo)"]]) {
      const button = element("button", label);
      button.type = "button";
      button.dataset.query = query;
      $("examples").append(button);
    }
  }

  function showMore() {
    const fragment = document.createDocumentFragment();
    for (const hit of current.hits.slice(visible, visible + PAGE_SIZE)) {
      const [pali, definition, grammar, source] = dictionary.entries[hit.id];
      const card = element("article", undefined, "result");
      const heading = element("h2", pali);
      heading.lang = "pi";
      const reverse = direction.value === "pli-en";
      const matchType = hit.partial ? `Partial match · ${hit.prefix ? "prefix" : "inside word"}` : reverse
        ? (current.kind === "fuzzy" ? "Suggested headword" : hit.exact ? "Exact headword" : "Diacritic-insensitive match")
        : (hit.exact ? "Direct gloss" : "Definition match");
      const cardHeading = element("div", undefined, "result-heading");
      cardHeading.append(heading, element("p", `${source} · ${matchType}`, "badge"));
      card.append(cardHeading);
      if (grammar) card.append(element("p", grammar, "grammar"));
      card.append(element("p", definition, "definition"));
      const matchLabel = `${hit.partial ? "Partial " : ""}${reverse ? "Pāli" : "English"} ${current.kind === "fuzzy" ? "substitute" : "match"}`;
      card.append(element("p", `${matchLabel}: ${reverse ? pali : hit.matched || current.matched}`, "matched"));
      fragment.append(card);
    }
    visible = Math.min(visible + PAGE_SIZE, current.hits.length);
    $("results").append(fragment);
    $("more").hidden = visible >= current.hits.length;
    $("more").textContent = `Show more (${visible} of ${current.hits.length})`;
  }

  function runSearch() {
    clearTimeout(timer);
    const reverse = direction.value === "pli-en";
    const language = reverse ? "Pāli" : "English";
    current = dictionary.search(input.value, direction.value, { partial: partial.checked });
    visible = 0;
    $("results").replaceChildren();
    $("suggestions").replaceChildren();
    $("more").hidden = true;
    if (current.kind === "empty") {
      status.textContent = reverse ? "Ready. Enter a Pāli word or phrase (up to 100 characters)."
        : "Ready. Enter an English word or phrase (up to 100 characters).";
      return;
    }
    if (current.kind === "none") {
      status.textContent = `No match or close spelling for “${input.value.trim()}”. Try another ${language} word or a shorter phrase.`;
      return;
    }
    const count = current.hits.length.toLocaleString("en");
    if (current.kind === "fuzzy") {
      status.textContent = `No exact match for “${input.value.trim()}”. Suggested ${language} substitute: “${current.matched}” — ${count} dictionary senses. This is a spelling suggestion, not a synonym.`;
      $("suggestions").append(element("span", "Possible spellings: "));
      for (const suggestion of current.suggestions) {
        const button = element("button", suggestion.label || suggestion.term);
        button.type = "button";
        button.addEventListener("click", () => choose(suggestion.term));
        $("suggestions").append(button);
      }
    } else if (current.kind === "partial") {
      status.textContent = `${language} “${input.value.trim()}”: no whole-${reverse ? "headword" : "word"} match. ${count} partial matches — ${reverse ? "matching typed diacritics first, then " : ""}prefixes, then matches inside words.`;
    } else if (reverse) {
      status.textContent = `Pāli “${input.value.trim()}”: ${count} dictionary senses. Exact spellings appear first, then matches with the typed diacritics; diacritic-insensitive matches may represent different words.`;
    } else {
      const direct = current.hits.filter(hit => hit.exact).length;
      status.textContent = `English “${current.matched}”: ${count} dictionary senses (${direct} direct glosses). Direct glosses appear first; other results contain the term in a longer definition.`;
    }
    const partialCount = current.hits.filter(hit => hit.partial).length;
    if (partialCount && current.kind !== "partial") {
      status.textContent += ` ${partialCount} partial matches follow whole-${reverse ? "headword" : "word"} matches.`;
    }
    showMore();
  }

  function choose(query) {
    input.value = query;
    input.setSelectionRange(query.length, query.length);
    runSearch();
    input.focus();
  }

  function previousLetter() {
    const end = input.selectionStart;
    const match = input.value.slice(0, end).match(/\p{L}\p{M}*$/u);
    return match ? { start: end - match[0].length, text: match[0].normalize("NFC") } : null;
  }

  function insertDiacritic(character) {
    const previous = previousLetter();
    const selected = input.selectionStart !== input.selectionEnd;
    const base = PaliSearch.normalize(character);
    let start = input.selectionStart;
    if (!selected && previous && PaliSearch.normalize(previous.text) === base) {
      start = previous.start;
      if (previous.text === previous.text.toUpperCase()) character = character.toUpperCase();
    }
    if (input.value.length - (input.selectionEnd - start) + character.length > input.maxLength) return;
    input.setRangeText(character, start, input.selectionEnd, "end");
    input.focus();
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  for (const character of "āīūṅñṭḍṇḷṃ") {
    const button = element("button", character);
    button.type = "button";
    button.lang = "pi";
    button.title = `Insert ${character} or change the preceding ${PaliSearch.normalize(character)}`;
    button.setAttribute("aria-label", button.title);
    // Keep the caret and the mobile keyboard in the input during pointer use.
    button.addEventListener("pointerdown", event => event.preventDefault());
    button.addEventListener("click", () => insertDiacritic(character));
    $("diacritic-buttons").append(button);
  }
  $("diacritics-toggle").addEventListener("pointerdown", event => event.preventDefault());
  $("diacritics-toggle").addEventListener("click", () => {
    const expanded = $("diacritics-toggle").getAttribute("aria-expanded") !== "true";
    $("diacritics-toggle").setAttribute("aria-expanded", String(expanded));
    $("diacritics").hidden = !expanded;
  });

  $("search-form").addEventListener("submit", event => {
    event.preventDefault();
    runSearch();
  });
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(runSearch, 150);
  });
  $("examples").addEventListener("click", event => {
    if (event.target.dataset.query) choose(event.target.dataset.query);
  });
  $("more").addEventListener("click", showMore);
  partial.addEventListener("change", runSearch);
  direction.addEventListener("change", () => {
    input.value = "";
    updateDirection();
    runSearch();
    input.focus();
  });
  updateDirection();
  input.value = (parameters.get("q") || "").slice(0, 100);
  runSearch();
})();
