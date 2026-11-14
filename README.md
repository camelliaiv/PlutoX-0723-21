# PlutoX 0723+21

**The cosmic time machine for SPHEREx.** A public web tool for NASA Space Apps Challenge 2026
(*Planet X and SPHEREx*): enter sky coordinates and see how that patch of sky changes across real
SPHEREx observations — the same "blink" idea Clyde Tombaugh used to discover Pluto in 1930.

## Features
- Search by RA/Dec (decimal degrees or `08h55m10.831s -07d14m42.53s`) or pick a challenge target
- Lists the available SPHEREx observations grouped by survey epoch and detector band
- Shareable links: `?ra=…&dec=…`

## Quick start
Requires Python 3.11+ and Node.js 20+.

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
cd backend  && ../.venv/Scripts/python -m pytest   # add "-m network" for the live archive test
cd frontend && npm test && npm run build
```

## Project structure
```
backend/    FastAPI service: coordinate parsing, SPHEREx archive search (IRSA SIA2), epoch grouping
frontend/   Vite + TypeScript web app
```

## Data & credits
- SPHEREx spectral images: NASA/IPAC Infrared Science Archive (IRSA), SPHEREx Data Release 1,
  accessed via the IVOA SIA2 service: https://irsa.ipac.caltech.edu/Missions/spherex.html
- Built with [Astropy](https://www.astropy.org/), FastAPI and Vite.
- Independent project using public NASA data; not affiliated with or endorsed by NASA.
- AI tools were used during development.
