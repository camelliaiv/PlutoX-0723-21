# PlutoX 0723+21

![PlutoX 0723+21 banner (AI-generated image)](assets/plutox-banner.png)

**The cosmic time machine for SPHEREx.** A public web tool for NASA Space Apps Challenge 2026
(*Planet X and SPHEREx*): enter sky coordinates and see how that patch of sky changes across real
SPHEREx observations — the same "blink" idea Clyde Tombaugh used to discover Pluto in 1930.

**Live app:** https://plutox-0723-21.onrender.com

## Features
- Search by RA/Dec (decimal degrees or `08h55m10.831s -07d14m42.53s`) or pick a challenge target
- Lists the available SPHEREx observations grouped by survey epoch and detector band
- Blink player of real SPHEREx per-epoch frames for a chosen detector (north up, east left, shared stretch, saturation overlay)
- Shareable links: `?target=…&detector=…` or `?ra=…&dec=…&detector=…`

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

## Frame cache
Frames of the five challenge targets are precomputed and committed in `backend/frame_cache/`, so
those targets open instantly and do not depend on IRSA being available; the page states when frames
come from the cache, when they were computed and from which data releases. Any other coordinates
are computed live. To regenerate the cache, for example after a new SPHEREx release:

```bash
cd backend
../.venv/Scripts/python -m app.precompute_frames --force
```

Options: `--targets <slugs...>`, `--detectors <1..6...>`, `--size <pixels>` (default 32),
`--force` (recompute even when a valid cache file exists) and `--search-responses <directory>` (use saved
IRSA search responses named `<target>_<collection>.xml` instead of querying IRSA; pixels are still read from
the archive mirror). A combination is cached only when both
releases answered and at least one frame was built; failed requests are retried up to five times,
and the exit code is 0 only if every requested combination succeeded.

## Deployment
The `Dockerfile` builds the frontend with Node and serves it together with the API from one FastAPI process
(port `$PORT`, default 10000). `render.yaml` describes a Render web service that builds this image from the
`develop` branch and checks `/api/health`.

## Known limitations
During the hackathon (14–15 November 2026) the NASA/IPAC Infrared Science Archive search (SIA2) and
cutout services repeatedly returned HTTP 502/503 errors. PlutoX needs only one thing from that search:
the list of SPHEREx exposures that cover a sky position. The image pixels themselves are read from the
public AWS mirror of the archive, which stayed available. The frames of the five challenge targets were
therefore computed from real archive search responses saved on 14 November 2026; exposures published
after that date are not included.

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
