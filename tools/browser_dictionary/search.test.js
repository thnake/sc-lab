"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { Dictionary, distance } = require("./search.js");

const entries = [
  ["sati", "memory; mindfulness", "feminine", "NCPED"],
  ["karuṇā", "compassion", "feminine", "NCPED"],
  ["sukha", "happy; pleasant", "adjective", "NCPED"],
  ["dukkhita", "not happy", "adjective", "NCPED"],
  ["test", "unhappy", "", "Test"],
  ["jhāna", "meditation", "", "Glossary"],
  ["mettā", "loving-kindness", "", "Test"],
  ["test2", "a feeling (of body, speech); peace", "", "Test"],
];
const dictionary = new Dictionary({ version: 1, entries });

test("exact glosses and whole-word explanations rank before partial matches", () => {
  const result = dictionary.search(" HAPPY ");
  assert.equal(result.kind, "exact");
  assert.deepEqual(result.hits.slice(0, 2), [{ id: 2, exact: true }, { id: 3, exact: false }]);
  assert.equal(result.hits[2].id, 4);
  assert.equal(result.hits[2].partial, true);
  assert.equal(result.hits[2].matched, "unhappy");
  assert.deepEqual(dictionary.search("happy", "en-pli", { partial: false }).hits,
    [{ id: 2, exact: true }, { id: 3, exact: false }]);
  assert.deepEqual(dictionary.search("not happy").hits, [{ id: 3, exact: true }]);
  assert.equal(dictionary.entries[1][0], "karuṇā");
});

test("English partial fragments and phrases precede fuzzy suggestions", () => {
  for (const [query, matched, prefix] of [["mindfulnes", "mindfulness", true],
    ["fulness", "mindfulness", false], ["loving ki", "loving kindness", true]]) {
    const result = dictionary.search(query);
    assert.equal(result.kind, "partial");
    assert.equal(result.suggestions.length, 0);
    assert.equal(result.hits[0].matched, matched);
    assert.equal(result.hits[0].prefix, prefix);
  }
  assert.equal(dictionary.search("mindfulnes", "en-pli", { partial: false }).kind, "fuzzy");
  assert.ok(dictionary.search("mi").hits.some(hit => hit.id === 0 && hit.partial));
  assert.ok(dictionary.search("m").hits.every(hit => !hit.partial));
});

test("prefix matches rank above infixes even when the infix word is shorter", () => {
  const data = new Dictionary({ version: 1, entries: [
    ["x", "unhappy", "", "Test"], ["y", "happyness", "", "Test"], ["z", "happy", "", "Test"],
  ] });
  const result = data.search("happy");
  assert.deepEqual(result.hits.map(hit => hit.id), [2, 1, 0]);
  assert.equal(result.hits[1].prefix, true);
  assert.equal(result.hits[2].prefix, false);
});

test("Pāli partial search preserves diacritics, ranking and unique numbered senses", () => {
  const data = new Dictionary({ version: 1, entries: [
    ["asati", "lack of memory", "", "Test"],
    ["satipaṭṭhāna", "establishment of mindfulness", "", "Test"],
    ["sati 1", "memory", "", "DPD"],
    ["sati 2", "being", "", "DPD"],
  ] });
  const result = data.search("sati", "pli-en");
  assert.deepEqual(new Set(result.hits.slice(0, 2).map(hit => hit.id)), new Set([2, 3]));
  assert.deepEqual(result.hits.slice(2).map(hit => hit.id), [1, 0]);
  assert.equal(new Set(result.hits.map(hit => hit.id)).size, result.hits.length);
  const partial = data.search("pattha", "pli-en");
  assert.equal(partial.kind, "partial");
  assert.equal(partial.hits[0].id, 1);
  assert.equal(partial.hits[0].prefix, false);
  assert.equal(data.search("sati", "pli-en", { partial: false }).hits.length, 2);
  assert.ok(data.search("sa", "pli-en").hits.every(hit => hit.partial));
  assert.ok(data.search("s", "pli-en").hits.every(hit => !hit.partial));
});

test("typos and transpositions show an explicit English substitute", () => {
  for (const [input, substitute] of [["mindfullness", "mindfulness"], ["meditaiton", "meditation"], ["compasion", "compassion"]]) {
    const result = dictionary.search(input);
    assert.equal(result.kind, "fuzzy");
    assert.equal(result.matched, substitute);
    assert.equal(result.suggestions[0].term, substitute);
    assert.ok(result.hits.length);
  }
});

test("phrases normalize punctuation without splitting parenthetical qualifiers", () => {
  assert.equal(dictionary.search("loving kindness").hits[0].id, 6);
  assert.equal(dictionary.search("loving kindnes").hits[0].matched, "loving kindness");
  assert.equal(dictionary.search("peace").hits[0].exact, true);
  assert.equal(dictionary.search("speech").hits[0].exact, false);
});

test("unrelated, short, empty, and overlong queries do not force a translation", () => {
  for (const query of ["qzxqzxqzx", "xy", "xyz"]) {
    assert.equal(dictionary.search(query).kind, "none");
  }
  for (const query of ["", "   ", "!!!", "a".repeat(101)]) {
    assert.equal(dictionary.search(query).kind, "empty");
  }
});

test("fuzzy matching does not replace function words or drop negation", () => {
  const data = new Dictionary({ version: 1, entries: [
    ["x", "or happy", "", "Test"], ["y", "happy", "", "Test"],
  ] });
  assert.equal(data.search("not happy").kind, "none");
  assert.equal(dictionary.search("not happpy").matched, "not happy");
});

test("Pāli headword lookup preserves definitions and accepts missing diacritics", () => {
  for (const query of ["mettā", "METTĀ", "metta", "mettā".normalize("NFD")]) {
    const result = dictionary.search(query, "pli-en");
    assert.deepEqual(result.hits.map(hit => hit.id), [6]);
    assert.equal(result.matched, "mettā");
    assert.equal(result.suggestions.length, 0);
  }
  assert.equal(dictionary.search("metta", "pli-en").kind, "normalized");
  assert.equal(dictionary.search("mettā", "pli-en").kind, "exact");
  assert.equal(dictionary.search("karuna", "pli-en").matched, "karuṇā");
  assert.equal(dictionary.search("compassion", "pli-en").kind, "none");
});

test("Pāli spelling collisions retain all words and prefer exact diacritics", () => {
  const data = new Dictionary({ version: 1, entries: [
    ["mala", "dirt", "", "Test"], ["mālā", "garland", "", "Test"],
    ["aṁsa", "shoulder", "", "Test"],
  ] });
  assert.deepEqual(data.search("mālā", "pli-en").hits, [{ id: 1, exact: true }, { id: 0, exact: false }]);
  assert.deepEqual(data.search("mala", "pli-en").hits, [{ id: 0, exact: true }, { id: 1, exact: false }]);
  assert.equal(data.search("aṃsa", "pli-en").hits[0].exact, true);
});

test("partly accented Pāli headwords prefer the explicitly matching marks before source order", () => {
  const data = new Dictionary({ version: 1, entries: [
    ["mālā 1", "garland", "", "DPD"], ["māla", "matching first vowel", "", "Test"],
    ["malā 1", "matching last vowel", "", "DPD"], ["mala", "dirt", "", "Test"],
  ] });
  assert.deepEqual(data.search("malā", "pli-en").hits.map(hit => hit.id), [2, 0, 3, 1]);
  assert.deepEqual(data.search("māla", "pli-en").hits.map(hit => hit.id), [1, 0, 2, 3]);
  assert.equal(data.search("mala", "pli-en").hits[0].id, 3);
});

test("accented fragments rank matching marks before prefixes, including later occurrences", () => {
  const data = new Dictionary({ version: 1, entries: [
    ["nalaka", "plain prefix", "", "Test"], ["anāḷaka", "two matching marks", "", "Test"],
    ["nālaka", "one matching mark", "", "Test"], ["nalanāḷa", "later accented occurrence", "", "Test"],
    ["nāḷa", "whole word", "", "Test"],
  ] });
  for (const query of ["nāḷa", "NĀḶA", "nāḷa".normalize("NFD")]) {
    assert.deepEqual(data.search(query, "pli-en").hits.map(hit => hit.id), [4, 3, 1, 2, 0]);
  }
  assert.deepEqual(data.search("nala", "pli-en").hits.map(hit => hit.id), [4, 0, 2, 3, 1]);
  assert.deepEqual(data.search("nāḷa", "pli-en", { partial: false }).hits.map(hit => hit.id), [4]);
  const niggahita = new Dictionary({ version: 1, entries: [
    ["amsaka", "plain", "", "Test"], ["aṁsaka", "marked", "", "Test"],
  ] });
  assert.equal(niggahita.search("aṃs", "pli-en").hits[0].id, 1);
});

test("Pāli fuzzy suggestions keep original spelling and do not force distant matches", () => {
  const result = dictionary.search("mettta", "pli-en");
  assert.equal(result.kind, "fuzzy");
  assert.equal(result.matched, "mettā");
  assert.equal(result.suggestions[0].label, "mettā");
  assert.deepEqual(result.hits.map(hit => hit.id), [6]);
  for (const query of ["qzxqzxqzx", "xy"]) assert.equal(dictionary.search(query, "pli-en").kind, "none");
  for (const query of ["", "!!!", "x".repeat(101)]) assert.equal(dictionary.search(query, "pli-en").kind, "empty");
  // English still uses the original index after the Pāli index is initialized.
  assert.equal(dictionary.search("compasion").matched, "compassion");
});

test("Pāli DPD lookup finds all numbered senses and supports an explicit sense number", () => {
  const data = new Dictionary({ version: 1, entries: [
    ["sati 1", "memory", "", "DPD"], ["sati 2", "being", "", "DPD"],
  ] });
  assert.deepEqual(new Set(data.search("sati", "pli-en").hits.map(hit => hit.id)), new Set([0, 1]));
  assert.deepEqual(data.search("sati 2", "pli-en").hits, [{ id: 1, exact: true }]);
});

test("Pāli dotted DPD senses rank in numeric order before other sources and partials", () => {
  const data = new Dictionary({ version: 1, entries: [
    ["dosa", "fault", "", "Glossary"],
    ["dosa 2.10", "later sense", "", "DPD"],
    ["dosa 2.2", "defect", "", "DPD"],
    ["dosa 1.1", "aversion; ill-will; hate; hatred", "", "DPD"],
    ["dosaggi", "fire of ill-will", "", "NCPED"],
    ["dosā 1", "spelling variant", "", "DPD"],
  ] });
  const result = data.search("dosa", "pli-en");
  assert.deepEqual(result.hits.map(hit => hit.id), [3, 2, 1, 0, 5, 4]);
  assert.ok(result.hits.slice(0, 4).every(hit => hit.exact && !hit.partial));
  assert.equal(result.hits[4].exact, false);
  assert.equal(result.hits[5].partial, true);
  assert.deepEqual(data.search("dosa 1.1", "pli-en", { partial: false }).hits, [{ id: 3, exact: true }]);
  assert.equal(data.search("dosā", "pli-en").hits[0].id, 5);
  assert.equal(data.search("dosa", "pli-en", { partial: false }).hits[0].id, 3);
});

test("bounded edit distance agrees with an independent full-matrix reference", () => {
  function reference(a, b) {
    const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
      }
    }
    return matrix[a.length][b.length];
  }
  let words = [""];
  let level = [""];
  for (let length = 1; length <= 4; length++) {
    level = level.flatMap(word => [word + "a", word + "b", word + "c"]);
    words.push(...level);
  }
  for (const a of words) for (const b of words) for (const limit of [1, 2, 3]) {
    const expected = reference(a, b);
    assert.equal(Math.min(distance(a, b, limit), limit + 1), Math.min(expected, limit + 1), `${a}/${b}/${limit}`);
  }
});

test("real generated corpus: essential words, homonyms, and nested headwords", () => {
  require("./data.js");
  const real = new Dictionary(globalThis.PALI_DICTIONARY);
  for (const [query, pali] of [["compassion", "karuṇā"], ["mindfullness", "sati"], ["key", "tāla"], ["heat", "tāpa"]]) {
    assert.ok(real.search(query).hits.some(hit => real.entries[hit.id][0] === pali), `${query} → ${pali}`);
  }
  assert.equal(real.search("qzxqzxqzx").kind, "none");
  for (const [query, pali] of [["metta", "mettā"], ["sati", "sati"], ["karuna", "karuṇā"]]) {
    assert.ok(real.search(query, "pli-en").hits.some(hit => real.entries[hit.id][0] === pali), `${query} → ${pali}`);
  }
  if (globalThis.PALI_DICTIONARY.sources.DPD) {
    for (const partial of [true, false]) {
      const dosa = real.search("dosa", "pli-en", { partial });
      assert.deepEqual(real.entries[dosa.hits[0].id],
        ["dosa 1.1", "aversion; ill-will; hate; hatred", "masc.", "DPD"]);
      assert.equal(dosa.hits[0].exact, true);
    }
    assert.ok(real.search("hate").hits.some(hit => hit.exact && real.entries[hit.id][0] === "dosa 1.1"));
  }
});
