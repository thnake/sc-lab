"""Build the standalone explorer from the existing chart and cached embeddings.

Requires numpy. Does not run clustering, modify old charts, or call an API.
"""

import base64
import csv
import json
from pathlib import Path
import re

import numpy as np


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent


def coordinates(values):
    if isinstance(values, dict):
        return np.frombuffer(base64.b64decode(values["bdata"]), dtype=values["dtype"]).tolist()
    return values


def build():
    chart = (ROOT / "data_exploration/output/sutta_clusters.html").read_text(encoding="utf-8")
    start = re.search(r'Plotly\.newPlot\(\s*"sutta-graph",\s*', chart)
    if start is None:
        raise ValueError("The existing chart's Plotly data could not be found")
    traces, _ = json.JSONDecoder().raw_decode(chart[start.end():])
    records = {}
    for trace in traces:
        horizontal = coordinates(trace["x"])
        vertical = coordinates(trace["y"])
        for index, uid in enumerate(trace["hovertext"]):
            records[uid] = {
                "uid": uid,
                "blurb": trace["customdata"][index][0],
                "book": trace["customdata"][index][1],
                "cluster": trace["name"].split(",")[0].strip(),
                "x": horizontal[index],
                "y": vertical[index],
            }
    with (ROOT / "data_exploration/cache/blurb_embeddings_uids.csv").open() as source:
        uids = [row["uid"] for row in csv.DictReader(source)]
    if len(uids) != len(set(uids)) or set(uids) != set(records):
        raise ValueError("Chart IDs and cached embedding IDs do not match; rebuild the original chart first")
    embeddings = np.load(ROOT / "data_exploration/cache/blurb_embeddings.npy")
    if embeddings.ndim != 2 or len(embeddings) != len(uids) or not np.isfinite(embeddings).all():
        raise ValueError("Invalid embedding cache")
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    if np.any(norms == 0):
        raise ValueError("Embedding cache contains zero-length vectors")
    normalized = (embeddings / norms).astype(np.float32)
    ordered = [records[uid] for uid in uids]
    translated = {
        path.name.removesuffix("_translation-en-sujato.json")
        for path in (ROOT / "sc-data/sc_bilara_data/translation/en/sujato").rglob("*_translation-en-sujato.json")
    }
    for record in ordered:
        record["url"] = "https://suttacentral.net/" + record["uid"]
        if record["uid"] in translated:
            record["url"] += "/en/sujato"
    count = min(12, len(uids) - 1)
    for start_index in range(0, len(uids), 256):
        similarities = normalized[start_index:start_index + 256] @ normalized.T
        for offset, scores in enumerate(similarities):
            own_index = start_index + offset
            scores[own_index] = -np.inf
            neighbors = np.argsort(-scores, kind="stable")[:count]
            ordered[own_index]["neighbors"] = [int(index) for index in neighbors]
    output = HERE / "data.js"
    output.write_text("window.SUTTAS = " + json.dumps(ordered, ensure_ascii=True, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"Built {len(ordered)} suttas with {count} neighbors each: {output}")


if __name__ == "__main__":
    build()