# %%
import pandas as pd


# %%

file = "data_exploration/occurences/sariputta.txt"

with open(file, "r", encoding="utf-8") as f:
    lines = f.readlines()

records = []
for line in lines:
    line = line.strip()[2::]

    records.append({"path": line})

df = pd.DataFrame.from_records(records)  # just to use pandas and avoid linter warnings
df.path = df.path.astype(str)

df["book"] = df.path.str.split("/").apply(lambda x: x[0])
df["sutta"] = df.path.str.split("/").apply(lambda x: x[-1])


suttas = df.query("book == 'an'").sutta.unique().tolist()
suttas.sort()
