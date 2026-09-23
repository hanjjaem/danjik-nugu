# 당직 누구

👉 [당직 누구 바로가기](https://hanjjaem.github.io/danjik-nugu/)

## 로컬 실행

Python 3.10 이상에서 저장소 루트의 PowerShell을 열고 다음 명령을 실행합니다.

```powershell
python -m http.server 8000 --directory app
```

브라우저에서 <http://localhost:8000>에 접속합니다. 종료할 때는 터미널에서 `Ctrl+C`를 누릅니다. 웹 화면에는 별도의 패키지 설치가 필요하지 않습니다.

## 엑셀 명단 갱신

명단을 변환할 때만 Python 가상환경과 패키지가 필요합니다.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
New-Item -ItemType Directory -Force data\raw
# data\raw 폴더에 .xls 또는 .xlsx 명단을 넣은 뒤:
.\.venv\Scripts\python.exe scripts\preprocess.py
```

변환 결과는 `app/data.js`에 저장되고 로컬 웹 화면에서 읽힙니다. 기존 데이터를 덮어쓰므로 원본 파일과 생성된 결과를 확인한 뒤 사용하세요. `app/data.js`는 현재 Git에 포함되어 있으므로 명단의 공개 범위를 확인한 후 커밋해야 합니다.
