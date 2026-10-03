# Quellen, Lizenzen und Weitergabe

Die Hinweise wurden am **3. Oktober 2026** anhand der unten verlinkten
Primärquellen geprüft. Die Daten werden nicht pauschal unter CC0, MIT oder
einer einheitlichen neuen Lizenz veröffentlicht.

## Digital Pāḷi Dictionary (DPD)

- **Werk:** Digital Pāḷi Dictionary.
- **Urheber:** Bodhirasa Bhikkhu.
- **Copyright:** Copyright (c) Bodhirasa Bhikkhu.
- **Original:** <https://dpdict.net/>.
- **Lizenz:** Creative Commons Attribution-NonCommercial-ShareAlike 4.0
  International, **CC BY-NC-SA 4.0**.
- **Lizenzlink:** <https://creativecommons.org/licenses/by-nc-sa/4.0/>.
- **Offizieller Hinweis:** <https://digitalpalidictionary.github.io/license/>.
- **Vollständiger Lizenztext:** [LICENSE-DPD.txt](LICENSE-DPD.txt), übernommen
  aus <https://github.com/digitalpalidictionary/dpd-db/blob/main/LICENSE>.
  Dieser enthält auch den Gewährleistungsausschluss und die Haftungsbegrenzung.

### Datenherkunft und Änderungen

Das Eingabeformat ist die bereits angepasste, leichtgewichtige SuttaCentral-
Ausgabe in `dictionaries/simple/en/pli2en_dpd.json`. Die vorherige Anpassung ist
in den [DPD-Integrationshinweisen](https://digitalpalidictionary.github.io/integrations/sutta_central/)
beschrieben. Eine vollständige vorherige Bearbeitungshistorie und die DPD-
Release-Version sind in dieser JSON-Datei nicht angegeben. Deshalb wird keine
aktuelle DPD-Versionsnummer behauptet. Der Build speichert den SHA-256-Hash der
tatsächlich verwendeten Eingabedatei in `PALI_DICTIONARY.sources.DPD.sha256`.

Zusätzliche Änderungen durch dieses Browser-Dictionary:

1. Auswahl der explizit fett markierten englischen Bedeutungen.
2. Extraktion von Grundform, Bedeutungsnummer und Grammatik aus dem Präfix.
3. Umwandlung von HTML in Text.
4. Deduplizierung flektierter Lookup-Formen zu Grundform-Bedeutungen.
5. Auslassung unstrukturierter Zerlegungen und unmarkierter älterer Definitionen.
6. Sortierung und Indexierung für Englisch → Pāli und Pāli → Englisch.

Das Ergebnis ist ein **bearbeiteter, unvollständiger Auszug**, nicht das
vollständige DPD. Eine Unterstützung oder offizielle Anerkennung dieser App
durch Bodhirasa Bhikkhu, DPD oder SuttaCentral wird nicht behauptet.

### Lizenz der Bearbeitung und Datenbankrechte

Die übernommenen DPD-Inhalte und die eigenen Beiträge dieses Projekts zu den
bearbeiteten DPD-Daten werden unter **CC BY-NC-SA 4.0** bereitgestellt. Soweit
diesem Projekt eigene Rechte an einer mit DPD erstellten bearbeiteten
Gesamtdatenbank zustehen, werden auch diese unter CC BY-NC-SA 4.0 bereitgestellt.
Das ändert **nicht** die Rechte an den einzelnen NCPED- oder Glossary-Inhalten
und erteilt keine bisher fehlende Erlaubnis für diese Quellen.

Bei Weitergabe müssen insbesondere Urheber-/Copyright-, Lizenz-, Quellen- und
Änderungshinweise erhalten bleiben. Die Nutzung muss nichtkommerziell sein;
Bearbeitungen müssen unter derselben oder einer zulässigen kompatiblen Lizenz
weitergegeben werden. Zusätzliche Einschränkungen der lizenzierten Rechte oder
entsprechende technische Schutzmaßnahmen dürfen nicht auferlegt werden.
Maßgeblich ist der vollständige Lizenztext, nicht diese Zusammenfassung.

### Kopierbarer Hinweis

> Enthält bearbeitete Auszüge aus dem **Digital Pāḷi Dictionary**, Copyright (c)
> **Bodhirasa Bhikkhu**, <https://dpdict.net/>, unter **CC BY-NC-SA 4.0**,
> <https://creativecommons.org/licenses/by-nc-sa/4.0/>. Bezogen über die bereits
> angepasste leichtgewichtige Ausgabe von SuttaCentral/sc-data. Weitere
> Änderungen: Auswahl explizit markierter Bedeutungen, Extraktion von Grundform,
> Bedeutungsnummer und Grammatik, Entfernung von HTML, Deduplizierung,
> Auslassung bestimmter Einträge sowie Sortierung und Suchindexierung. Dies ist
> ein unvollständiger, bearbeiteter Auszug. Die bearbeiteten DPD-Daten und eigenen
> Beiträge dazu stehen ebenfalls unter CC BY-NC-SA 4.0. Die Inhalte werden,
> soweit gesetzlich zulässig, ohne Gewähr bereitgestellt; siehe Abschnitt 5
> des vollständigen Lizenztexts für Gewährleistungsausschluss und Haftungsbegrenzung.

## NCPED: Lizenzzuordnung noch offen

Quelle: [pli2en_ncped.json bei SuttaCentral](https://github.com/suttacentral/sc-data/blob/main/dictionaries/simple/en/pli2en_ncped.json).
Die [Wörterbuch-README](https://github.com/suttacentral/sc-data/blob/main/dictionaries/README.md)
beschreibt die Grundlage als Ven. Buddhadattas CPED, überarbeitet und korrigiert
unter Heranziehung von Cones *Dictionary of Pali*. Das dokumentiert die Herkunft,
ist aber keine Lizenzfreigabe dieser Autoren oder ihrer Verlage.

Änderungen: Definitionen und Grammatik einschließlich rekursiver Homonyme
extrahiert, Markup in Text umgewandelt, reine Querverweise ausgelassen,
Datensätze dedupliziert, sortiert und für die Suche indexiert.

Eine ausdrückliche dateispezifische Lizenz und die vollständige erforderliche
Urheberangabe konnten nicht verifiziert werden. SuttaCentrals
[allgemeine Lizenzrichtlinie](https://suttacentral.net/licensing) stellt eigene
Originalinhalte unter CC0, unterscheidet aber Drittmaterial. Daraus wird hier
keine pauschale CC0-Freigabe des NCPED abgeleitet.

## Glossary: Lizenzzuordnung noch offen

Quelle: [pli2en_glossary.json bei SuttaCentral](https://github.com/suttacentral/sc-data/blob/main/dictionaries/glossaries/en/pli2en_glossary.json).
Die Datei enthält kurze englische Glosses ohne dateispezifischen Rechtehinweis.
Eine ausdrückliche Lizenz und vollständige Urheberangabe konnten nicht
verifiziert werden. Auch hier wird keine pauschale CC0-Freigabe behauptet.

Änderungen: Glosses extrahiert, Markup in Text umgewandelt, Datensätze
dedupliziert, sortiert und für die Suche indexiert.

## Anfrage zur Klärung bei SuttaCentral

Die Klärung kann über das [SuttaCentral-Forum](https://discourse.suttacentral.net/)
oder die Maintainer des [sc-data-Repositories](https://github.com/suttacentral/sc-data)
erfolgen. Folgender Entwurf kann dafür verwendet werden:

> Hello! I am preparing a free, noncommercial English ↔ Pāli browser dictionary
> using these files from SuttaCentral/sc-data:
>
> - `dictionaries/simple/en/pli2en_ncped.json`
> - `dictionaries/glossaries/en/pli2en_glossary.json`
>
> Could you confirm the license and required attribution for each file,
> including any third-party material? In particular, does CC0 cover all contents
> of these particular files, and may I publicly redistribute modified extracts
> on GitHub Pages and in a downloadable offline dataset?
>
> My processing converts markup to plain text, extracts definitions/glosses,
> deduplicates records and creates English and Pāli search indexes. Source
> labels and provenance are retained. I will document all modifications and
> preserve the applicable attribution and license notices. DPD is handled
> separately under CC BY-NC-SA 4.0.
>
> If there are additional required credits, notices or permission restrictions,
> please specify them. Thank you!

Eine Antwort beziehungsweise Erlaubnis sollte mit Datum und Bezug auf die
konkreten Dateien dokumentiert werden. Erst dann können die bislang offenen
Angaben in `source-notices.json`, `licenses.html` und diesem Dokument ersetzt
werden. **Die Kennzeichnung „ungeklärt“ ist selbst keine Nutzungserlaubnis.**

## Veröffentlichung und Offline-Paket

Bei einer Veröffentlichung des Dictionary-Inhalts gehören diese Dateien zum
statischen Paket:

```text
index.html
style.css
app.js
search.js
data.js                 # lokal oder im Deployment-Build erzeugt
licenses.html
LICENSE-DPD.txt
source-notices.json
LICENSES.md
README.md
```

`data.js` enthält zusätzlich die Quellenhinweise, Bearbeitungsbeschreibung,
Lizenz-/Disclaimer-Links und Prüfsummen der konkreten Eingabedateien. Der Build
benötigt `source-notices.json`; er macht dafür keine Netzwerkaufrufe.
Auch bei `--output` in ein anderes Verzeichnis sind die begleitenden Dateien
mitzukopieren. `--no-dpd` entfernt DPD, klärt aber nicht die übrigen Datenlizenzen.

Bei separater Weitergabe von DPD-Datenauszügen sind die dazugehörigen Hinweise
und der Lizenztext beziehungsweise Lizenzlink ebenfalls mitzugeben.

Für unabhängig geschriebenen Anwendungscode wird hier keine neue Lizenz
festgelegt; die Datenlizenz ist keine pauschale Softwarelizenz. Diese Hinweise
ändern auch keine Lizenzen anderer Dateien im Repository. Die tatsächliche
Nutzung muss die Lizenzbedingungen einhalten; Dokumentation allein macht eine
kommerzielle DPD-Nutzung oder eine ungeklärte Datenweitergabe nicht zulässig.
