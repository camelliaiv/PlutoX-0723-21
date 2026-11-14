# Credits

## Data

### SPHEREx
SPHEREx Data Release 1 spectral images, served by the NASA/IPAC Infrared Science Archive (IRSA):
https://irsa.ipac.caltech.edu/Missions/spherex.html

> This publication makes use of data products from the Spectro-Photometer for the History of the
> Universe, Epoch of Reionization and Ices Explorer (SPHEREx), which is a joint project of the Jet
> Propulsion Laboratory and the California Institute of Technology, and is funded by the National
> Aeronautics and Space Administration.

Accessed through the IRSA Simple Image Access (SIA2) service and the IRSA public AWS mirror
(`nasa-irsa-spherex`).

### Gaia
Positions and proper motions of the challenge targets were checked against Gaia Data Release 3
(ESA Gaia Archive).

> This work has made use of data from the European Space Agency (ESA) mission Gaia
> (https://www.cosmos.esa.int/gaia), processed by the Gaia Data Processing and Analysis Consortium
> (DPAC, https://www.cosmos.esa.int/web/gaia/dpac/consortium). Funding for the DPAC has been provided
> by national institutions, in particular the institutions participating in the Gaia Multilateral
> Agreement.

- Gaia Collaboration et al. (2016b): The Gaia mission
- Gaia Collaboration et al. (2023j): Gaia DR3: Summary of the contents and survey properties

### AllWISE and CatWISE2020
Positions and proper motions of WISE 0855−0714 and Epsilon Indi B were taken from the AllWISE Source
Catalog and the CatWISE2020 Catalog, served by IRSA.

### Challenge
NASA Space Apps Challenge 2026, *Planet X and SPHEREx*: challenge statement and the coordinates of
WISE 0855−0714. https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/

## Software
This work made use of Astropy (https://www.astropy.org), a community-developed core Python package and
an ecosystem of tools and resources for astronomy:
Astropy Collaboration 2013 (2013A&A...558A..33A), 2018 (2018AJ....156..123A), 2022 (2022ApJ...935..167A).

Also used: NumPy, FastAPI, Uvicorn, HTTPX, pytest, Ruff, Vite, Vitest, TypeScript, happy-dom, Prettier.
Exact versions are pinned in `backend/requirements*.txt` and `frontend/package-lock.json`.

The IRSA SPHEREx tutorial notebooks (https://caltech-ipac.github.io/irsa-tutorials/) were used as the
reference for reading spectral image wavelengths and flags.

## AI assistance
Claude Code (Anthropic) was used as an AI assistant for planning, code and documentation.
