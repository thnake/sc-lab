# %%
import json
import glob

# %%

canon_root = "sc_bilara_data/root/pli/ms/sutta/**/*.json"
files = glob.glob(canon_root, recursive=True)

suttas = []
for file_path in files:
    with open(file_path, "r") as file:
        sutta = json.load(file)
        suttas.append(sutta)

        for v in sutta.values()

# with open()
