# sc-data

Content for SuttaCentral, including texts both legacy and bilara, parallels, structure, and other metadata.

NOTE: Please report _translation typos_ in the pinned thread in the [Feedback category of our forum](https://discourse.suttacentral.net/c/feedback/19)

## English ↔ Pāli browser dictionary

Run `python3 browser_dictionary/build.py`, then open
[`browser_dictionary/index.html`](browser_dictionary/index.html) in a browser.
The dictionary works offline in both directions, supports Pāli input without
diacritics, includes explicit spelling suggestions, and requires no additional packages. See
[`browser_dictionary/README.md`](browser_dictionary/README.md) for NCPED, Glossary,
and DPD coverage, data limitations, and tests.
Source-specific rights and modifications are documented in
[`browser_dictionary/LICENSES.md`](browser_dictionary/LICENSES.md).
DPD extracts are CC BY-NC-SA 4.0; file-specific licensing and attribution for
NCPED and Glossary still need confirmation before public data redistribution.

## Dictionary Package Selection

From this directory, run `python3 build.py` to choose dictionary packages in
the terminal. Each yes/no prompt displays the package's license and rights
notice; pressing Enter excludes that package. Selecting no packages or
cancelling leaves the existing output unchanged.

For unattended builds, specify packages explicitly:

```sh
python3 build.py --sources DPD
python3 build.py --sources NCPED Glossary
```

Only selected packages are read and included in the generated entries and
source notices. The legacy `--include-dpd` (all packages) and `--no-dpd`
(NCPED + Glossary) options still work without prompting. NCPED and Glossary
licenses remain unconfirmed; package selection does not grant redistribution
rights.

## deprecated

- `additional-info/blurbs.json`: use `bilara-data/tree/published/root/en/blurb` instead.
