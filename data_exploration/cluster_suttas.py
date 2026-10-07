# %%
"""Cluster suttas by the semantic similarity of their English blurbs and plot them interactively.

Pipeline: load blurbs -> embed with OpenAI -> cluster embeddings -> project to 2D -> plot.
Run cell-by-cell (# %%) in VS Code, or as a plain script.
"""
import glob
import json
import os
import re
import time

import numpy as np
import pandas as pd
import plotly.express as px
from dotenv import load_dotenv
from openai import OpenAI, RateLimitError
from sklearn.cluster import KMeans
from sklearn.manifold import TSNE
from tqdm import tqdm

load_dotenv()

BLURB_GLOB = "sc-data/sc_bilara_data/root/en/blurb/*.json"
EXCLUDED_FILE_PREFIXES = ("pli-tv", "super")  # vinaya rules and collection-level blurbs, not suttas
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_BATCH_SIZE = 100
EMBEDDING_MAX_RETRIES = 8  # backoff naturally paces requests to stay under the account's TPM limit
N_CLUSTERS = 20

CACHE_DIR = "data_exploration/cache"
EMBEDDINGS_CACHE_PATH = f"{CACHE_DIR}/blurb_embeddings.npy"
EMBEDDINGS_PARTIAL_PATH = f"{CACHE_DIR}/blurb_embeddings.partial.npy"
UIDS_CACHE_PATH = f"{CACHE_DIR}/blurb_embeddings_uids.csv"
OUTPUT_PATH = "data_exploration/output/sutta_clusters.html"
OUTPUT_PATH_3D = "data_exploration/output/sutta_clusters_3d.html"


# %% Load and flatten every collection's blurb file into one sutta-level DataFrame.
def load_blurbs() -> pd.DataFrame:
    records = []
    for file_path in glob.glob(BLURB_GLOB):
        filename = os.path.basename(file_path)
        if filename.startswith(EXCLUDED_FILE_PREFIXES):
            continue

        with open(file_path, encoding="utf-8") as f:
            data = json.load(f)

        for key, blurb in data.items():
            uid = key.split(":")[-1]
            if "vagga" in uid or not re.search(r"\d", uid):
                continue  # skip chapter/collection-level descriptions, keep individual suttas

            book_match = re.match(r"[a-z\-]+", uid)
            records.append(
                {
                    "uid": uid,
                    "book": book_match.group() if book_match else uid,
                    "blurb": blurb.strip(),
                }
            )

    return pd.DataFrame.from_records(records).drop_duplicates(subset="uid").reset_index(drop=True)


df = load_blurbs()
print(f"Loaded {len(df)} sutta blurbs across {df.book.nunique()} books")
df.book.value_counts()


# %% Embed every blurb with OpenAI, caching to disk so re-runs don't re-pay for the API calls.
def embed_batch_with_retry(client: OpenAI, batch: list[str]) -> list[list[float]]:
    for attempt in range(EMBEDDING_MAX_RETRIES):
        try:
            response = client.embeddings.create(model=EMBEDDING_MODEL, input=batch)
            return [item.embedding for item in response.data]
        except RateLimitError:
            if attempt == EMBEDDING_MAX_RETRIES - 1:
                raise
            time.sleep(2**attempt)
    raise AssertionError("unreachable")


def embed_blurbs(blurbs: pd.DataFrame) -> np.ndarray:
    if os.path.exists(EMBEDDINGS_CACHE_PATH) and os.path.exists(UIDS_CACHE_PATH):
        cached_uids = pd.read_csv(UIDS_CACHE_PATH)["uid"].tolist()
        if cached_uids == blurbs["uid"].tolist():
            return np.load(EMBEDDINGS_CACHE_PATH)

    os.makedirs(CACHE_DIR, exist_ok=True)
    client = OpenAI()
    texts = blurbs["blurb"].tolist()

    # resume from a previous run's checkpoint instead of re-embedding from scratch
    vectors = np.load(EMBEDDINGS_PARTIAL_PATH).tolist() if os.path.exists(EMBEDDINGS_PARTIAL_PATH) else []
    start = len(vectors)

    for i in tqdm(range(start, len(texts), EMBEDDING_BATCH_SIZE), desc="Embedding blurbs"):
        batch = texts[i : i + EMBEDDING_BATCH_SIZE]
        vectors.extend(embed_batch_with_retry(client, batch))
        np.save(EMBEDDINGS_PARTIAL_PATH, np.array(vectors))

    vectors = np.array(vectors)
    np.save(EMBEDDINGS_CACHE_PATH, vectors)
    blurbs[["uid"]].to_csv(UIDS_CACHE_PATH, index=False)
    os.remove(EMBEDDINGS_PARTIAL_PATH)
    return vectors


embeddings = embed_blurbs(df)
embeddings.shape


# %% Cluster in the full embedding space, then project to 2D and 3D for plotting.
kmeans = KMeans(n_clusters=N_CLUSTERS, random_state=42, n_init="auto")
df["cluster"] = kmeans.fit_predict(embeddings).astype(str)

tsne_2d = TSNE(n_components=2, random_state=42, perplexity=min(30, len(df) - 1), init="pca")
coords_2d = tsne_2d.fit_transform(embeddings)
df["x"], df["y"] = coords_2d[:, 0], coords_2d[:, 1]

tsne_3d = TSNE(n_components=3, random_state=42, perplexity=min(30, len(df) - 1), init="pca")
coords_3d = tsne_3d.fit_transform(embeddings)
df["x3"], df["y3"], df["z3"] = coords_3d[:, 0], coords_3d[:, 1], coords_3d[:, 2]
df["search_text"] = (df["uid"] + " " + df["blurb"]).str.lower()


# %% Render figures with the blurb detail shown in a fixed panel below the plot, plus a text search box.
GRAPH_DIV_ID = "sutta-graph"
INFO_PANEL_ID = "sutta-info-panel"
SEARCH_INPUT_ID = "sutta-search-input"
SEARCH_STATUS_ID = "sutta-search-status"
MATCH_OPACITY = 0.85
DIMMED_OPACITY = 0.03

# hoverinfo="none" suppresses Plotly's floating tooltip but still fires hover events we listen for below.
# customdata columns (set via hover_data below) are [blurb, book, search_text, ...], so index 2 is always
# the searchable text regardless of how many extra (hidden) columns a given figure carries.
INFO_PANEL_JS = f"""
(function () {{
    var gd = document.getElementById("{GRAPH_DIV_ID}");
    var searchInput = document.getElementById("{SEARCH_INPUT_ID}");
    var searchStatus = document.getElementById("{SEARCH_STATUS_ID}");

    gd.on("plotly_click", function (evt) {{
        var uid = evt.points[0].hovertext;
        window.open("https://suttacentral.net/" + encodeURIComponent(uid) + "/en/sujato", "_blank", "noopener,noreferrer");
    }});

    gd.on("plotly_hover", function (evt) {{
        var panel = document.getElementById("{INFO_PANEL_ID}");
        var pt = evt.points[0];
        panel.innerHTML = "<b>" + pt.hovertext + "</b> \\u00b7 " + pt.customdata[1] + "<br>" + pt.customdata[0];
    }});
    gd.on("plotly_unhover", function () {{
        var panel = document.getElementById("{INFO_PANEL_ID}");
        panel.innerHTML = "Hover over a point to see its blurb here.";
    }});

    function applySearch() {{
        var query = searchInput.value.trim().toLowerCase();
        var traceIndices = gd.data.map(function (_, i) {{ return i; }});
        var totalMatches = 0;
        var opacityUpdate = gd.data.map(function (trace) {{
            var rows = trace.customdata || [];
            return rows.map(function (row) {{
                var isMatch = query === "" || String(row[2] || "").indexOf(query) !== -1;
                if (isMatch) {{ totalMatches += 1; }}
                return isMatch ? {MATCH_OPACITY} : {DIMMED_OPACITY};
            }});
        }});
        Plotly.restyle(gd, {{ "marker.opacity": opacityUpdate }}, traceIndices);
        searchStatus.textContent = query === "" ? "" : totalMatches + " match" + (totalMatches === 1 ? "" : "es");
    }}

    searchInput.addEventListener("input", applySearch);
}})();
"""


def render_with_info_panel(fig, title: str, output_path: str) -> None:
    fig.update_traces(hoverinfo="none")
    fig.update_layout(title=title, legend_title_text="Cluster", margin=dict(b=10))

    plot_div = fig.to_html(
        full_html=False,
        include_plotlyjs="cdn",
        div_id=GRAPH_DIV_ID,
        post_script=INFO_PANEL_JS,
        config={"responsive": True},
    )
    html_doc = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{title}</title>
<style>
  html, body {{ margin: 0; height: 100%; font-family: -apple-system, Arial, sans-serif; }}
    .site-nav {{ box-sizing: border-box; min-height: 48px; display: flex; flex-wrap: wrap; align-items: center; gap: 0 20px; padding: 0 24px; border-bottom: 1px solid #ddd; background: #fafafa; font-size: 14px; }}
    .site-nav strong {{ margin-right: auto; color: #243c35; }}
    .site-nav a {{ padding: 12px 0; color: #53665e; text-decoration: none; }}
    .site-nav a:hover {{ color: #27644e; text-decoration: underline; }}
    .site-nav a[aria-current="page"] {{ color: #27644e; box-shadow: inset 0 -2px #27644e; font-weight: 600; }}
    .site-nav a:focus-visible {{ outline: 2px solid #27644e; outline-offset: 3px; }}
  #sutta-search-bar {{
    height: 44px; box-sizing: border-box; display: flex; align-items: center; gap: 10px;
    padding: 0 24px; border-bottom: 1px solid #ddd;
  }}
    #{SEARCH_INPUT_ID} {{ flex: 0 1 320px; min-width: 0; padding: 6px 10px; font-size: 14px; border: 1px solid #bbb; border-radius: 4px; }}
  #{SEARCH_STATUS_ID} {{ font-size: 13px; color: #555; }}
    #{GRAPH_DIV_ID} {{ height: calc(85vh - 92px); width: 100%; }}
  #{INFO_PANEL_ID} {{
    height: 15vh; box-sizing: border-box; overflow-y: auto;
    padding: 10px 24px; border-top: 2px solid #ddd; background: #fafafa;
    font-size: 14px; line-height: 1.4; color: #333;
  }}
</style>
</head>
<body>
<nav class="site-nav" aria-label="SC Lab">
    <strong>SC Lab</strong>
    <a href="sutta_clusters.html" aria-current="page">Sutta Clusters</a>
    <a href="../../tools/browser_dictionary/index.html">Dictionary</a>
</nav>
<div id="sutta-search-bar">
  <input id="{SEARCH_INPUT_ID}" type="text" placeholder="Search suttas by id or blurb text..." autocomplete="off" />
  <span id="{SEARCH_STATUS_ID}"></span>
</div>
{plot_div}
<div id="{INFO_PANEL_ID}">Hover over a point to see its blurb here.</div>
</body>
</html>
"""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_doc)
    print(f"Saved interactive plot to {output_path}")


# %% Build the 2D scatter, colored by cluster.
fig = px.scatter(
    df,
    x="x",
    y="y",
    color="cluster",
    symbol="book",
    hover_name="uid",
    hover_data={"blurb": True, "book": True, "search_text": True, "x": False, "y": False, "cluster": False},
)
fig.update_traces(marker=dict(size=6, opacity=0.75))
render_with_info_panel(fig, f"Clustered visualization of {len(df)} suttas (by blurb embedding similarity)", OUTPUT_PATH)


# %% Build the 3D scatter, same data, one more axis to spread the clusters out.
fig_3d = px.scatter_3d(
    df,
    x="x3",
    y="y3",
    z="z3",
    color="cluster",
    symbol="book",
    hover_name="uid",
    hover_data={
        "blurb": True,
        "book": True,
        "search_text": True,
        "x3": False,
        "y3": False,
        "z3": False,
        "cluster": False,
    },
)
fig_3d.update_traces(marker=dict(size=3, opacity=0.75))
render_with_info_panel(fig_3d, f"Clustered visualization of {len(df)} suttas in 3D (by blurb embedding similarity)", OUTPUT_PATH_3D)
