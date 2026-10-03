#!/usr/bin/env python3
"""Optional real-browser smoke checks using an existing Chrome/Chromium binary."""

import argparse
from pathlib import Path
import shutil
import subprocess
import tempfile
from urllib.parse import urlencode

HERE = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--browser", default=shutil.which("google-chrome") or shutil.which("chromium"))
    args = parser.parse_args()
    if not args.browser:
        parser.error("Chrome/Chromium not found; pass --browser /path/to/browser")
    if not (HERE / "data.js").exists():
        parser.error("Run python3 browser_dictionary/build.py first")

    with tempfile.TemporaryDirectory(prefix="pali-browser-") as temporary:
        def render(path, query="", direction="en-pli"):
            url = path.as_uri() + "?" + urlencode({"q": query, "direction": direction})
            result = subprocess.run([
                args.browser, "--headless", "--no-sandbox", "--disable-gpu",
                "--disable-dev-shm-usage", "--no-first-run", "--disable-background-networking",
                f"--user-data-dir={temporary}/profile", "--dump-dom", "--virtual-time-budget=3000", url,
            ], capture_output=True, text=True, timeout=30, check=True)
            return result.stdout

        for query, expected, has_results in [
            ("compassion", "English match: compassion", True),
            ("mindfullness", "English substitute: mindfulness", True),
            ("qzxqzxqzx", "No match or close spelling", False),
            ("", "Ready. Enter an English word", False),
        ]:
            dom = render(HERE / "index.html", query)
            assert expected in dom, f"Missing rendered state for {query!r}"
            assert ('class="result"' in dom) == has_results, f"Unexpected cards for {query!r}"
            assert 'id="search-button" disabled' not in dom, "Search stayed disabled"
            assert 'href="licenses.html"' in dom, "Missing public license page link"
            assert 'href="LICENSE-DPD.txt"' in dom, "Missing offline DPD license link"
            dpd_notice = dom.split('id="dpd-attribution"', 1)[1].split('>', 1)[0]
            included_dpd = 'DPD' in dom.split('id="metadata"', 1)[1]
            assert ('hidden' not in dpd_notice) == included_dpd, "DPD credit visibility disagrees with included data"
            if query == "compassion":
                assert 'lang="pi">karuṇā</h2>' in dom, "Pāli diacritics were lost"
            print(f"PASS file:// query {query!r}")

        license_dom = render(HERE / "licenses.html")
        assert "Bodhirasa Bhikkhu" in license_dom
        assert "CC BY-NC-SA 4.0" in license_dom
        assert "File-specific license and required creator attribution remain unconfirmed." in license_dom
        print("PASS offline license page and source credits")

        for query, expected in [
            ("sati", "Exact headword"),
            ("karuna", "Pāli match: karuṇā"),
            ("mettta", "Pāli substitute: mettā"),
        ]:
            dom = render(HERE / "index.html", query, "pli-en")
            assert expected in dom, f"Missing Pāli result for {query!r}"
            assert "Diacritics are optional." in dom
            assert 'class="result"' in dom
            print(f"PASS file:// Pāli query {query!r}")

        for query, direction, expected in [
            ("mindfulnes", "en-pli", "Partial English match: mindfulness"),
            ("met", "pli-en", "Partial Pāli match: mettā"),
        ]:
            dom = render(HERE / "index.html", query, direction)
            assert expected in dom, f"Missing partial results for {query!r}"
            assert "Partial match · prefix" in dom
            print(f"PASS file:// partial query {query!r}")

        # Exercise change/submit/click handlers in the actual browser, too.
        interaction = Path(temporary) / "interaction"
        interaction.mkdir()
        for name in ("app.js", "search.js", "style.css", "data.js"):
            shutil.copyfile(HERE / name, interaction / name)
        html = (HERE / "index.html").read_text(encoding="utf-8")
        (interaction / "index.html").write_text(html.replace(
            "</head>", '<script defer src="interaction.js"></script></head>'
        ), encoding="utf-8")
        (interaction / "interaction.js").write_text("""
            const direction = document.getElementById('direction');
            const input = document.getElementById('query');
            const status = document.getElementById('status');
            function check(value) { if (!value) throw new Error('Interaction check failed'); }
            function submit() { document.getElementById('search-form').dispatchEvent(new Event('submit', {cancelable: true})); }
            check(document.getElementById('results').textContent.includes('compassion'));
            direction.value = 'pli-en';
            direction.dispatchEvent(new Event('change'));
            check(input.value === '' && document.getElementById('results').children.length === 0);
            const diacritics = document.getElementById('diacritics');
            const toggle = document.getElementById('diacritics-toggle');
            check(!toggle.hidden && diacritics.hidden);
            check(toggle.getAttribute('aria-expanded') === 'false');
            input.value = 'karuna';
            input.setSelectionRange(5, 5);
            toggle.click();
            check(!diacritics.hidden);
            check(toggle.getAttribute('aria-expanded') === 'true');
            check(input.value === 'karuna' && input.selectionStart === 5);
            toggle.click();
            check(diacritics.hidden && toggle.getAttribute('aria-expanded') === 'false');
            toggle.click();
            function letter(character) {
                [...document.querySelectorAll('#diacritic-buttons button')]
                    .find(button => button.textContent === character).click();
                check(document.activeElement === input);
            }
            input.value = 'karuna';
            input.setSelectionRange(5, 5);
            letter('ṇ');
            check(input.value === 'karuṇa' && input.selectionStart === 5);
            input.setSelectionRange(6, 6);
            letter('ā');
            check(input.value === 'karuṇā' && input.selectionStart === 6);
            submit();
            check(document.querySelector('#results .result .badge').textContent.includes('Exact headword'));
            input.value = 'n';
            input.setSelectionRange(1, 1);
            for (const expected of ['ṇ', 'ṅ', 'ñ']) {
                letter(expected);
                check(input.value === expected);
            }
            input.value = 'A';
            input.setSelectionRange(1, 1);
            letter('ā');
            check(input.value === 'Ā');
            input.value = 'a\\u0304';
            input.setSelectionRange(2, 2);
            letter('ā');
            check(input.value === 'ā' && input.selectionStart === 1);
            input.value = 'metta';
            input.setSelectionRange(4, 5);
            letter('ā');
            check(input.value === 'mettā' && input.selectionStart === 5);
            input.value = '';
            input.setSelectionRange(0, 0);
            letter('ṃ');
            check(input.value === 'ṃ');
            input.value = 'a'.repeat(100);
            input.setSelectionRange(0, 0);
            letter('ā');
            check(input.value.length === 100);
            input.setSelectionRange(100, 100);
            const shortcut = new KeyboardEvent('keydown', {
                key: 'x', altKey: true, bubbles: true, cancelable: true
            });
            input.dispatchEvent(shortcut);
            check(!shortcut.defaultPrevented);
            check(input.value === 'a'.repeat(100));
            if (PALI_DICTIONARY.sources.DPD) {
                input.value = 'dosa';
                submit();
                const first = document.querySelector('#results .result');
                check(first.querySelector('h2').textContent === 'dosa 1.1');
                check(first.querySelector('.definition').textContent === 'aversion; ill-will; hate; hatred');
                check(first.querySelector('.badge').textContent === 'DPD · Exact headword');
            }
            input.value = 'mettta';
            submit();
            check(status.textContent.includes('Suggested Pāli substitute'));
            document.querySelector('#suggestions button').click();
            check(document.getElementById('results').textContent.includes('mettā'));
            check(!status.textContent.includes('Suggested'));
            direction.value = 'en-pli';
            direction.dispatchEvent(new Event('change'));
            check(toggle.hidden && diacritics.hidden);
            document.querySelector('#examples button[data-query="compassion"]').click();
            check(status.textContent.includes('English “compassion”'));
            const partial = document.getElementById('partial');
            input.value = 'mindfulnes';
            submit();
            check(document.getElementById('results').textContent.includes('Partial English match: mindfulness'));
            partial.click();
            check(status.textContent.includes('Suggested English substitute'));
            check(!document.getElementById('results').textContent.includes('Partial match'));
            partial.click();
            check(document.getElementById('results').textContent.includes('Partial match'));
            direction.value = 'pli-en';
            direction.dispatchEvent(new Event('change'));
            check(!toggle.hidden && diacritics.hidden);
            check(toggle.getAttribute('aria-expanded') === 'false');
            toggle.click();
            input.value = 'metta';
            input.setSelectionRange(5, 5);
            letter('ā');
            // The insertion must trigger the normal debounced live search.
            setTimeout(() => {
                check(status.textContent.includes('Pāli “mettā”'));
                check(document.querySelector('#results .result .badge').textContent.includes('Exact headword'));
                document.body.dataset.interaction = 'passed';
            }, 250);
        """, encoding="utf-8")
        assert 'data-interaction="passed"' in render(interaction / "index.html", "compassion")
        print("PASS direction switching, diacritic menu, live input, caret/selection, buttons and partial toggle")

        missing = Path(temporary) / "missing-data"
        missing.mkdir()
        for name in ("index.html", "app.js", "search.js", "style.css"):
            shutil.copyfile(HERE / name, missing / name)
        assert "Dictionary data is missing. Run:" in render(missing / "index.html")
        print("PASS missing-data recovery instructions")


if __name__ == "__main__":
    main()
