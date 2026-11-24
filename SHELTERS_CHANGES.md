# Shelter feature (Anjali): what changed

## Data
- `backend/data/shelters.csv` now has **69 real sites** from the UN/IOM (2011) report *Identification of Open Spaces for
  Humanitarian Purposes in Kathmandu Valley* (Kathmandu, Lalitpur, Bhaktapur), with coordinates from the report.
  Capacity = area / 45 m² per person (Sphere camp minimum); grouped sites split the group's area equally.
  `flood_prone=yes` marks sites the report places on the Bagmati riverbank (Bagmati Corridors, Pashupati, Teku, Balkumari).
  Ring Road strips and one site with a misprinted coordinate (Army Golf Club) are left out.
- Rebuild it any time with `python tools/make_shelters.py backend/data/shelters.csv`.

## Backend (`main.py`)
- **Shelter status, live with the rain:** `safe` / `watch` / `unsafe` / `outside`, from the 75th-percentile risk of roads
  within 200 m. Riverbank sites become `watch` at moderate rain and `unsafe` in heavy rain. Sites more than 400 m from the
  mapped road network are `outside`: shown on the map, never routed to.
- **Nearest *safe* shelter routing:** flooding shelters are skipped, and the response lists closer ones that were skipped
  and why (`skipped_shelters`), plus 3 backup shelters (`alternatives`). "Check first" sites count as 5 min further.
- **Import:** `POST /api/shelters/import` with `{"csv": "name,lat,lon,capacity\n..."}`. Saved to
  `data/shelters_imported.csv`, so imports survive a restart. OSM schools/community centres within 80 m of a CSV site are de-duplicated.
- **New:** `GET /api/shelters` (counts + open capacity); `/api/facilities` now carries status, capacity, source.
- **Offline cache (fixes the venue Wi-Fi risk):** the first online start saves roads + terrain to `backend/cache/`.
  Later starts load from it with **no internet needed**. `REFRESH=1` re-downloads.

## Frontend (`App.jsx`, `app.css`)
- Tent markers coloured by status (hospitals get a red cross), a popup with capacity, source and **Route here**, and a map legend.
- RESPOND: shelter summary, the chosen shelter card, a "Skipped closer shelters" box, a clickable backup shelter table,
  and a CSV upload/paste import.
- PLAN: shelter readiness under the selected design storm.

## Before the presentation
1. At home with good internet: start the backend once with `$env:CITY="kathmandu"` so `backend/cache/` is created. Commit that folder.
2. Consider `$env:CENTER="27.6950,85.3150"; $env:RADIUS_M="2500"`. The current default (centre 27.7172, 85.3240, 1.5 km)
   does **not reach the Bagmati**, the river that flooded in Sep 2024, and only ~8 of the 69 shelters fall inside it.
