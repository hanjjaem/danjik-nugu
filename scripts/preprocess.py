"""data/raw/*.xls* 당직 명단을 app/data.js (DUTY_DATA JS 배열)로 변환."""
import glob
import json
import pathlib

import pandas as pd

RAW_DIR = pathlib.Path(__file__).resolve().parent.parent / "data" / "raw"
OUT_FILE = pathlib.Path(__file__).resolve().parent.parent / "app" / "data.js"

COLUMN_MAP = {
    "당직일자": "date",
    "당직구분": "type",
    "당직직책": "role",
    "부서": "dept",
    "직급": "rank",
    "성명": "name",
}


def load_all():
    frames = []
    for path in sorted(glob.glob(str(RAW_DIR / "*.xls*"))):
        if pathlib.Path(path).name.startswith("~$"):
            continue
        df = pd.read_excel(path)
        df = df.rename(columns=COLUMN_MAP)[list(COLUMN_MAP.values())]
        frames.append(df)
    combined = pd.concat(frames, ignore_index=True)
    combined = combined.dropna(subset=["name"])
    combined = combined[~combined["rank"].str.contains("운전", na=False)]
    combined["date"] = pd.to_datetime(combined["date"]).dt.strftime("%Y-%m-%d")
    combined = combined.sort_values(["date"]).reset_index(drop=True)
    return combined


def main():
    df = load_all()
    records = df.to_dict(orient="records")
    OUT_FILE.write_text(
        "const DUTY_DATA = " + json.dumps(records, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    print(f"{len(records)}건 -> {OUT_FILE}")


if __name__ == "__main__":
    main()
