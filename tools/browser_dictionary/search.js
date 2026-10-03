/* Shared by the browser and Node's built-in test runner. No runtime dependencies. */
(function (root) {
  "use strict";

  const STOP_WORDS = new Set("a an the to of in on at by for with and or is be as from it that one who which".split(" "));
  const NEGATIONS = new Set(["not", "no", "without", "never", "neither", "nor"]);
  const HEADWORD_ORDER = new Intl.Collator("en", { numeric: true });

  function normalize(text) {
    return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
      .replace(/[’‘]/g, "'").replace(/[^a-z0-9']/g, " ").replace(/\s+/g, " ").trim();
  }

  function glosses(definition) {
    // Do not split qualifiers such as “(of body, speech)” into fake meanings.
    const parts = [];
    let part = "";
    let depth = 0;
    for (const char of definition) {
      if (char === "(" || char === "[") depth++;
      if (char === ")" || char === "]") depth = Math.max(0, depth - 1);
      if ((char === ";" || char === ",") && depth === 0) {
        parts.push(part);
        part = "";
      } else {
        part += char;
      }
    }
    parts.push(part);
    // Keep negations and qualifiers; only drop leading English articles / “to”.
    return [...new Set(parts.map(value => normalize(value).replace(/^(?:a|an|the|to) /, "")).filter(Boolean))];
  }

  function distance(a, b, limit) {
    // Bounded optimal-string-alignment distance, including adjacent transpositions.
    if (Math.abs(a.length - b.length) > limit) return limit + 1;
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    let beforePrevious = previous;
    for (let i = 1; i <= a.length; i++) {
      const current = Array(b.length + 1).fill(limit + 1);
      current[0] = i;
      let minimum = current[0];
      for (let j = Math.max(1, i - limit); j <= Math.min(b.length, i + limit); j++) {
        current[j] = Math.min(previous[j] + 1, current[j - 1] + 1,
          previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          current[j] = Math.min(current[j], beforePrevious[j - 2] + 1);
        }
        minimum = Math.min(minimum, current[j]);
      }
      if (minimum > limit) return limit + 1;
      beforePrevious = previous;
      previous = current;
    }
    return previous[b.length];
  }

  function suggestTerms(query, vocabulary, accept = () => true, isDirect = () => true, count = 5) {
    if (query.length < 3 || query.length > 64) return [];
    const limit = query.length <= 5 ? 1 : query.length <= 9 ? 2 : 3;
    const candidates = [];
    for (let length = query.length - limit; length <= query.length + limit; length++) {
      for (const candidate of vocabulary.get(length) || []) {
        if (!accept(candidate)) continue;
        const edits = distance(query, candidate, limit);
        const relative = edits / Math.max(query.length, candidate.length);
        if (edits === 0 || edits > limit || relative > 0.34) continue;
        candidates.push({ term: candidate, edits, relative, direct: isDirect(candidate) });
      }
    }
    return candidates.sort((a, b) => a.edits - b.edits || a.relative - b.relative
      || Number(b.direct) - Number(a.direct) || (a.term < b.term ? -1 : a.term > b.term ? 1 : 0))
      .slice(0, count);
  }

  function paliSpelling(term) {
    return term.normalize("NFC").toLowerCase().replace(/ṁ/g, "ṃ").replace(/\s+/g, " ").trim();
  }

  function paliLemma(term) {
    // DPD stores sense numbers in the headword; keep those on result cards.
    return term.replace(/\s+\d+(?:\.\d+)*$/, "");
  }

  function spellingLetters(term) {
    // Same positions as normalize(), but retain each letter's combining marks.
    return paliSpelling(term).normalize("NFKD").replace(/[’‘]/g, "'")
      .replace(/[^a-z0-9'\p{M}]/gu, " ").replace(/\s+/g, " ").trim()
      .match(/[a-z0-9']\p{M}*| /gu) || [];
  }

  function partialHits(texts, query, existing, wordPrefixes = false) {
    if (query.length < 2) return [];
    const excluded = new Set(existing.map(hit => hit.id));
    const hits = [];
    texts.forEach((text, id) => {
      if (excluded.has(id)) return;
      let index = text.indexOf(query);
      if (index < 0) return;
      const wordStart = wordPrefixes ? text.indexOf(` ${query}`) : -1;
      const prefix = text.startsWith(query) || wordStart >= 0;
      if (!text.startsWith(query) && wordStart >= 0) index = wordStart + 1;
      const start = text.lastIndexOf(" ", index - 1) + 1;
      const end = text.indexOf(" ", index + query.length);
      const matched = text.slice(start, end < 0 ? text.length : end);
      hits.push({ id, exact: false, partial: true, prefix, matched });
    });
    return hits.sort((a, b) => Number(b.prefix) - Number(a.prefix)
      || a.matched.length - b.matched.length || texts[a.id].length - texts[b.id].length || a.id - b.id);
  }

  class PaliDictionary {
    constructor(entries) {
      this.entries = entries;
      this.headwordTexts = entries.map(entry => normalize(entry[0]));
      this.spellings = entries.map(entry => spellingLetters(entry[0]));
      this.headwords = new Map();
      this.labels = new Map();
      this.vocabulary = new Map();
      entries.forEach((entry, id) => {
        for (const spelling of new Set([entry[0], paliLemma(entry[0])])) {
          const key = normalize(spelling);
          if (!key) continue;
          if (!this.headwords.has(key)) {
            this.headwords.set(key, []);
            this.labels.set(key, new Set());
            if (!this.vocabulary.has(key.length)) this.vocabulary.set(key.length, []);
            this.vocabulary.get(key.length).push(key);
          }
          this.headwords.get(key).push(id);
          this.labels.get(key).add(spelling);
        }
      });
    }

    lookup(term) {
      const spelling = paliSpelling(term);
      const score = this.diacriticScores(term);
      return [...new Set(this.headwords.get(normalize(term)) || [])].map(id => ({ id,
        exact: [this.entries[id][0], paliLemma(this.entries[id][0])].some(value => paliSpelling(value) === spelling),
      })).sort((a, b) => Number(b.exact) - Number(a.exact)
        || score(b.id) - score(a.id)
        // Prefer DPD's numbered senses in dictionary order, not definition length.
        || Number(this.entries[b.id][3] === "DPD") - Number(this.entries[a.id][3] === "DPD")
        || (this.entries[a.id][3] === "DPD" && this.entries[b.id][3] === "DPD"
          ? HEADWORD_ORDER.compare(this.entries[a.id][0], this.entries[b.id][0]) : 0)
        || this.entries[a.id][1].length - this.entries[b.id][1].length || a.id - b.id);
    }

    label(key) {
      return [...this.labels.get(key)].join(" / ");
    }

    diacriticScores(term) {
      const query = normalize(term);
      const marked = spellingLetters(term).map((letter, index) => ({ letter, index }))
        .filter(({ letter }) => /\p{M}/u.test(letter));
      const scores = new Map();
      return id => {
        if (!marked.length) return 0;
        if (scores.has(id)) return scores.get(id);
        let best = 0;
        const text = this.headwordTexts[id];
        // A later occurrence can match the accents even if the first does not.
        for (let offset = text.indexOf(query); offset >= 0; offset = text.indexOf(query, offset + 1)) {
          const score = marked.filter(({ letter, index }) => this.spellings[id][offset + index] === letter).length;
          best = Math.max(best, score);
        }
        scores.set(id, best);
        return best;
      };
    }

    search(term, { partial = true } = {}) {
      const query = normalize(term);
      if (!query || query.length > 100) return { query, matched: "", kind: "empty", hits: [], suggestions: [] };
      const hits = this.lookup(term);
      const partials = partial ? partialHits(this.headwordTexts, query, hits) : [];
      const score = this.diacriticScores(term);
      partials.sort((a, b) => score(b.id) - score(a.id));
      if (hits.length || partials.length) return { query, matched: hits.length ? this.label(query) : query,
        kind: hits.length ? (hits.some(hit => hit.exact) ? "exact" : "normalized") : "partial",
        hits: [...hits, ...partials], suggestions: [] };
      const suggestions = suggestTerms(query, this.vocabulary)
        .map(suggestion => ({ ...suggestion, label: this.label(suggestion.term) }));
      const candidate = suggestions[0];
      return { query, matched: candidate?.label || "", kind: candidate ? "fuzzy" : "none", suggestions,
        hits: candidate ? this.lookup(candidate.term) : [] };
    }
  }

  class Dictionary {
    constructor(data) {
      if (data.version !== 1 || !Array.isArray(data.entries)) throw new Error("Unsupported dictionary format");
      this.entries = data.entries;
      this.words = new Map();
      this.phrases = new Map();
      this.definitions = [];
      this.keys = [];
      const add = (map, key, id) => {
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(id);
      };
      this.entries.forEach((entry, id) => {
        const definition = normalize(entry[1]);
        const keys = glosses(entry[1]);
        this.definitions.push(` ${definition} `);
        this.keys.push(new Set(keys));
        for (const word of new Set(definition.split(" "))) {
          if (word) add(this.words, word, id);
        }
        for (const key of keys) add(this.phrases, key, id);
      });
      this.vocabulary = new Map();
      const vocabulary = new Set([...this.words.keys(), ...this.phrases.keys()]);
      for (const term of vocabulary) {
        if (term.length < 3 || term.length > 64 || STOP_WORDS.has(term) || !/[a-z]/.test(term)) continue;
        if (!this.vocabulary.has(term.length)) this.vocabulary.set(term.length, []);
        this.vocabulary.get(term.length).push(term);
      }
    }

    lookup(term) {
      const query = normalize(term);
      if (!query) return [];
      const tokens = query.split(" ");
      const lists = tokens.map(token => this.words.get(token) || []);
      const smallest = lists.reduce((a, b) => a.length < b.length ? a : b);
      const ids = new Set(this.phrases.get(query) || []);
      for (const id of smallest) {
        if (this.definitions[id].includes(` ${query} `)) ids.add(id);
      }
      return [...ids].map(id => ({ id, exact: this.keys[id].has(query) }))
        .sort((a, b) => Number(b.exact) - Number(a.exact)
          || this.entries[a.id][1].length - this.entries[b.id][1].length || a.id - b.id);
    }

    suggest(term, count = 5) {
      const query = normalize(term);
      if (query.length < 3 || query.length > 64 || STOP_WORDS.has(query) || NEGATIONS.has(query)) return [];
      const tokens = query.split(" ");
      const protectedWords = words => words.filter(word => STOP_WORDS.has(word) || NEGATIONS.has(word)).join(" ");
      const protectedQuery = protectedWords(tokens);
      return suggestTerms(query, this.vocabulary, candidate => {
        // Do not turn “not happy” into “or happy”, or silently drop a negation.
        const candidateTokens = candidate.split(" ");
        return candidateTokens.length === tokens.length && protectedWords(candidateTokens) === protectedQuery;
      }, candidate => this.phrases.has(candidate), count);
    }

    search(term, direction = "en-pli", options = {}) {
      if (direction === "pli-en") {
        // Build the small headword index only when the other direction is used.
        if (!this.pali) this.pali = new PaliDictionary(this.entries);
        return this.pali.search(term, options);
      }
      const query = normalize(term);
      if (!query || query.length > 100) return { query, matched: "", kind: "empty", hits: [], suggestions: [] };
      const hits = this.lookup(query);
      const partials = options.partial === false ? [] : partialHits(this.definitions, query, hits, true);
      if (hits.length || partials.length) return { query, matched: query,
        kind: hits.length ? "exact" : "partial", hits: [...hits, ...partials], suggestions: [] };
      const suggestions = this.suggest(query);
      const matched = suggestions[0]?.term || "";
      return { query, matched, kind: matched ? "fuzzy" : "none", suggestions,
        hits: matched ? this.lookup(matched) : [] };
    }
  }

  const api = { Dictionary, normalize, glosses, distance };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PaliSearch = api;
})(globalThis);
