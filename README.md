# PlutoX 0723+21

**The cosmic time machine for SPHEREx.** A public web tool for NASA Space Apps Challenge 2026
(*Planet X and SPHEREx*): enter sky coordinates and see how that patch of sky changes across real
SPHEREx observations — the same "blink" idea Clyde Tombaugh used to discover Pluto in 1930.

## Features
- Search by RA/Dec (decimal degrees or `08h55m10.831s -07d14m42.53s`) or pick a challenge target
- Lists the available SPHEREx observations grouped by survey epoch and detector band
- Shareable links: `?ra=…&dec=…`

## Quick start
Requires Python 3.11+ and Node.js 22.12+.

```bash
# backend
python -m venv .venv
.venv/Scripts/pip install -r backend/requirements-dev.txt   # macOS/Linux: .venv/bin/pip
cd backend
../.venv/Scripts/python -m uvicorn app.main:app --reload  # http://127.0.0.1:8000

# frontend (second terminal)
cd frontend
npm ci
npm run dev                                                # http://localhost:5173
```

## Tests
```bash
cd backend  && ../.venv/Scripts/python -m pytest && ../.venv/Scripts/python -m ruff check . && ../.venv/Scripts/python -m ruff format --check .
cd frontend && npm test && npm run format:check && npm run build
```
Add `-m network` to `pytest` to also run the live archive test.

## Project structure
```
backend/    FastAPI service: coordinate parsing, SPHEREx archive search (IRSA SIA2), epoch grouping
frontend/   Vite + TypeScript web app
```

## Data & credits
SPHEREx Data Release 1 images from the NASA/IPAC Infrared Science Archive (IRSA); target positions from
ESA Gaia DR3, AllWISE and CatWISE2020. Full acknowledgements in [CREDITS.md](CREDITS.md).

Independent project using public NASA data; not affiliated with or endorsed by NASA.
