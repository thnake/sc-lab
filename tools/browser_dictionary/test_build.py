"""Data-shape regressions; run with Python's built-in unittest runner."""

from contextlib import redirect_stderr, redirect_stdout
from hashlib import sha256
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

import build as builder
from build import dpd_records, plain, simple_records


class BuildTests(unittest.TestCase):
    def test_dialog_shows_licenses_and_selects_only_approved_sources(self):
        output = io.StringIO()
        with patch("builtins.input", side_effect=["invalid", "", "no", "YES"]), redirect_stdout(output):
            self.assertEqual(builder.select_sources(), ["DPD"])
        self.assertIn("License: unconfirmed", output.getvalue())
        self.assertIn("CC-BY-NC-SA-4.0", output.getvalue())
        self.assertIn("Please enter yes or no", output.getvalue())

    def test_unselected_sources_are_not_read_or_distributed(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "DPD.json").write_text(json.dumps([
                {"entry": "sati", "definition": "sati 1: fem. <b>memory</b>"},
            ]), encoding="utf-8")
            output = root / "data.js"
            paths = {source: f"{source}.json" for source in builder.SOURCES}
            with patch.object(builder, "ROOT", root), patch.object(builder, "SOURCES", paths), \
                    patch.object(sys, "argv", ["build.py", "--sources", "DPD", "--output", str(output)]), \
                    redirect_stdout(io.StringIO()):
                builder.main()
            script = output.read_text(encoding="utf-8")
            data = json.loads(script.split("globalThis.PALI_DICTIONARY = ", 1)[1].removesuffix(";\n"))
            self.assertEqual(set(data["sources"]), {"DPD"})
            self.assertEqual({entry[3] for entry in data["entries"]}, {"DPD"})
            self.assertNotIn("// NCPED:", script)
            self.assertNotIn("// Glossary:", script)

    def test_declining_all_sources_preserves_existing_output(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "data.js"
            output.write_text("existing data", encoding="utf-8")
            with patch.object(sys, "argv", ["build.py", "--output", str(output)]), \
                    patch("builtins.input", return_value="no"), redirect_stdout(io.StringIO()), \
                    redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                builder.main()
            self.assertEqual(output.read_text(encoding="utf-8"), "existing data")

    def test_distributed_payload_preserves_source_rights_and_input_fingerprints(self):
        fixtures = {
            "NCPED": [{"entry": "sati", "definition": "memory"}],
            "Glossary": [{"entry": "sati", "gloss": "memory"}],
            "DPD": [{"entry": "sati", "definition": ["sati 1: fem. <b>memory</b>"]}],
        }
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            paths = {source: f"{source}.json" for source in fixtures}
            for source, rows in fixtures.items():
                (root / paths[source]).write_text(json.dumps(rows), encoding="utf-8")
            output = root / "data.js"
            for include_dpd in (True, False):
                with self.subTest(include_dpd=include_dpd):
                    argv = ["build.py", "--output", str(output)]
                    argv.append("--include-dpd" if include_dpd else "--no-dpd")
                    with patch.object(builder, "ROOT", root), patch.object(builder, "SOURCES", paths), \
                            patch.object(sys, "argv", argv), redirect_stdout(io.StringIO()):
                        builder.main()
                    script = output.read_text(encoding="utf-8")
                    data = json.loads(script.split("globalThis.PALI_DICTIONARY = ", 1)[1].removesuffix(";\n"))
                    self.assertEqual({entry[3] for entry in data["entries"]}, set(data["sources"]))
                    self.assertEqual("DPD" in data["sources"], include_dpd)
                    for source, notice in data["sources"].items():
                        self.assertEqual(notice["sha256"], sha256((root / paths[source]).read_bytes()).hexdigest())
                        self.assertTrue(notice["sourceUrl"])
                        self.assertTrue(notice["modifications"])
                    for source in ("NCPED", "Glossary"):
                        self.assertIsNone(data["sources"][source]["license"])
                        self.assertEqual(data["sources"][source]["licenseStatus"], "unconfirmed")
                    if include_dpd:
                        dpd = data["sources"]["DPD"]
                        self.assertEqual(dpd["creator"], "Bodhirasa Bhikkhu")
                        self.assertEqual(dpd["license"], "CC-BY-NC-SA-4.0")
                        self.assertIn("Section 5", dpd["disclaimer"])
                        self.assertTrue(dpd["databaseRightsNotice"])
                        self.assertTrue(Path(builder.__file__).with_name(dpd["localLicenseFile"]).is_file())

    def test_nested_homonyms_keep_their_own_headwords_and_grammar(self):
        rows = [{"entry": "tādisaka", "homonyms": [
            {"grammar": "adjective", "definition": "of such a kind"},
            {"entry": "tāla", "homonyms": [
                {"grammar": "neuter", "definition": "a key"},
                {"grammar": "masculine", "definition": ["a palm", "a measure"]},
                {"xr": "tāḷa"},
            ]},
        ]}]
        self.assertEqual(list(simple_records(rows, "NCPED")), [
            ("tādisaka", "of such a kind", "adjective", "NCPED"),
            ("tāla", "a key", "neuter", "NCPED"),
            ("tāla", "a palm", "masculine", "NCPED"),
            ("tāla", "a measure", "masculine", "NCPED"),
        ])

    def test_html_arrays_and_cross_references(self):
        rows = [
            {"entry": "sati", "grammar": ["feminine", "noun"], "definition": ["<b>memory</b>", "mindfulness"]},
            {"entry": "satī", "xr": "sati"},
        ]
        records = list(simple_records(rows, "NCPED"))
        self.assertEqual(len(records), 2)
        self.assertEqual(records[0], ("sati", "memory", "feminine; noun", "NCPED"))
        self.assertEqual(plain("<b>one</b><br>two &amp; three"), "one two & three")

    def test_dpd_uses_lemma_and_only_marked_meanings(self):
        definition = "abaddha 1: pp. <b>not bound; <i>unfettered</i></b> [na + √badh + ta]"
        rows = [
            {"entry": "abaddho", "definition": [definition, "abaddhaṁ + ca"]},
            {"entry": "abaddhe", "definition": [definition, "legacy: nt. unmarked"]},
        ]
        self.assertEqual(set(dpd_records(rows)), {
            ("abaddha 1", "not bound; unfettered", "pp.", "DPD"),
        })

    def test_unknown_definition_shapes_fail_visibly(self):
        with self.assertRaises(ValueError):
            list(simple_records([{"entry": "x", "definition": {"unexpected": "shape"}}], "NCPED"))


if __name__ == "__main__":
    unittest.main()
