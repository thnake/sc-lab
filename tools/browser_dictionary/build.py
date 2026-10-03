#!/usr/bin/env python3
"""Build the offline dictionary using only Python's standard library."""

import argparse
from hashlib import sha256
from html.parser import HTMLParser
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2] / "sc-data"
SOURCES = {
    "NCPED": "dictionaries/simple/en/pli2en_ncped.json",
    "Glossary": "dictionaries/glossaries/en/pli2en_glossary.json",
    "DPD": "dictionaries/simple/en/pli2en_dpd.json",
}


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)

    def handle_starttag(self, tag, attrs):
        if tag in {"br", "p", "div", "li"}:
            self.parts.append(" ")

    def handle_endtag(self, tag):
        if tag in {"p", "div", "li"}:
            self.parts.append(" ")


def plain(value):
    parser = PlainText()
    parser.feed(value)
    return " ".join("".join(parser.parts).split())


def strings(value):
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, list) and all(isinstance(item, str) for item in value):
        return value
    raise ValueError(f"Unexpected dictionary value: {value!r}")


def simple_records(rows, source, inherited_entry=None):
    for row in rows:
        entry = row.get("entry", inherited_entry)
        if not isinstance(entry, str) or not entry:
            raise ValueError(f"Missing headword: {row!r}")
        grammar = "; ".join(plain(s) for s in strings(row.get("grammar")))
        for definition in strings(row.get("gloss" if source == "Glossary" else "definition")):
            definition = plain(definition)
            if definition:
                # Each sense stays separate. Cross-reference-only records are omitted.
                yield (entry, definition, grammar, source)
        # NCPED also has nested homonyms, some with their own explicit headword.
        yield from simple_records(row.get("homonyms", []), source, entry)


def dpd_records(rows):
    """Deduplicate inflected lookup forms by the lemma encoded in each definition.

    Only explicitly bold English meanings are used. Unstructured compound
    analyses and non-bold legacy entries cannot be inverted reliably.
    """
    for row in rows:
        for definition in strings(row.get("definition")):
            match = re.match(r"^([^:<>]+):\s*([^<>]*?)<b>(.*?)</b>", definition, re.DOTALL)
            if not match:
                continue
            lemma, grammar, meaning = match.groups()
            meaning = plain(meaning)
            if meaning:
                yield (plain(lemma), meaning, plain(grammar), "DPD")


def select_sources():
    notices = json.loads(Path(__file__).with_name("source-notices.json").read_text(encoding="utf-8"))
    selected = []
    print("Choose dictionary packages to include. Review each source's licensing before redistribution.")
    for source in SOURCES:
        notice = notices[source]
        print(f"\n{source}: {notice['title']}")
        print(f"License: {notice['license'] or 'unconfirmed'}")
        print(notice["licenseNotice"])
        while True:
            answer = input(f"Include {source}? [y/N]: ").strip().lower()
            if answer in {"", "n", "no", "y", "yes"}:
                if answer in {"y", "yes"}:
                    selected.append(source)
                break
            print("Please enter yes or no.")
    return selected


def build(include_dpd=True, selected_sources=None):
    records = set()
    sources = {}
    notices = json.loads(Path(__file__).with_name("source-notices.json").read_text(encoding="utf-8"))
    for source, relative_path in SOURCES.items():
        if selected_sources is not None and source not in selected_sources:
            continue
        if source == "DPD" and not include_dpd:
            continue
        path = ROOT / relative_path
        source_bytes = path.read_bytes()
        rows = json.loads(source_bytes.decode("utf-8"))
        reader = dpd_records if source == "DPD" else lambda rows: simple_records(rows, source)
        extracted = set(reader(rows))
        records.update(extracted)
        sources[source] = {
            **notices[source],
            "path": relative_path,
            "inputEntries": len(rows),
            "sha256": sha256(source_bytes).hexdigest(),
            "distributionUrl": f"https://github.com/suttacentral/sc-data/blob/main/{relative_path}",
        }
        print(f"{source}: {len(rows):,} source entries → {len(extracted):,} distinct senses")
    # Deterministic output, including ordering of homonyms and duplicate senses.
    return {"version": 1, "sources": sources, "entries": sorted(records)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    dpd = parser.add_mutually_exclusive_group()
    dpd.add_argument("--include-dpd", dest="include_dpd", action="store_true", help="build all sources without prompting")
    dpd.add_argument("--no-dpd", dest="include_dpd", action="store_false", help="build a smaller NCPED + Glossary dataset")
    parser.set_defaults(include_dpd=None)
    parser.add_argument("--sources", nargs="+", choices=list(SOURCES), help="select packages without prompting")
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("data.js"))
    args = parser.parse_args()
    if args.sources is not None and args.include_dpd is not None:
        parser.error("use --sources or the DPD flags, not both")
    selected_sources = args.sources
    if selected_sources is None and args.include_dpd is None:
        try:
            selected_sources = select_sources()
        except (EOFError, KeyboardInterrupt):
            parser.exit(1, "\nSelection cancelled; no output written. Use --sources for unattended builds.\n")
        if not selected_sources:
            parser.error("no packages selected; no output written")
    data = build(args.include_dpd is not False, selected_sources)
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    # Also safe if the dataset is embedded in an HTML script in future.
    payload = payload.replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    header = "// Dictionary data: source-specific rights apply; see PALI_DICTIONARY.sources.\n"
    for source, notice in data["sources"].items():
        header += f"// {source}: {notice.get('copyright', notice['title'])}; {notice['license'] or 'license unconfirmed'}.\n"
        if notice.get("licenseUrl"):
            header += f"// {notice['licenseUrl']}\n"
    header += "// Modified extract; attribution, changes and disclaimers are embedded below.\n"
    args.output.write_text(f"{header}globalThis.PALI_DICTIONARY = {payload};\n", encoding="utf-8")
    size = args.output.stat().st_size
    print(f"Built {args.output}: {len(data['entries']):,} senses, {size / 1024 / 1024:.2f} MiB")


if __name__ == "__main__":
    main()
