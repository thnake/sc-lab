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

### Build Arguments

Run these commands from `tools/browser_dictionary`.

| Argument | What it does |
| --- | --- |
| No arguments | Prompts you to choose each package after showing its license notice. |
| `--sources NAME [NAME ...]` | Includes only the named packages, without prompting. Names are case-sensitive: `NCPED`, `Glossary`, and `DPD`. Separate multiple names with spaces, not commas. |
| `--include-dpd` | Includes all three packages without prompting. |
| `--no-dpd` | Includes only NCPED and Glossary without prompting. |
| `--output PATH` | Writes the JavaScript dataset to this path instead of the default `data.js` beside the build script. Relative paths are resolved from your current directory; the parent directory must already exist. |
| `-h`, `--help` | Shows available arguments and exits without building. |

Choose one selection method: `--sources`, `--include-dpd`, or `--no-dpd`.
These options cannot be combined. You can use `--output` with any selection
method, or with the interactive prompts.

```sh
# Show the command-line help.
python3 build.py --help

# Build all packages into the default data.js.
python3 build.py --include-dpd

# Build only NCPED and Glossary into the default data.js.
python3 build.py --no-dpd

# Build only DPD into a separate file.
python3 build.py --sources DPD --output dpd-data.js
```

The browser app loads `data.js`; a custom output filename does not change
which file the app loads. An existing output file is overwritten after a
successful build.

## deprecated

- `additional-info/blurbs.json`: use `bilara-data/tree/published/root/en/blurb` instead.
