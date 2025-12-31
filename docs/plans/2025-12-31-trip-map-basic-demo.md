# Trip Map Basic Demo (Local) Implementation Plan

> **For Codex:** Implement directly in this workspace (no worktree required for this small change).

**Goal:** Make `trips/trip-map` reliably runnable as a local demo via `npm run dev`, showing a basemap + photo markers.

**Architecture:** Keep the current Vite + Leaflet app, but make the data pipeline and map rendering robust (valid coordinates/time only, basemap layer, visible marker icons, and sane time filtering).

**Tech Stack:** Vite, Leaflet, Leaflet.TimeDimension, Leaflet.markercluster, Node worker_threads + exifr.

---

### Task 1: Make `npm run dev` self-contained

**Files:**
- Modify: `trips/trip-map/package.json`

**Steps:**
1. Update `dev` script to generate `photos.json` before starting Vite.
2. Run: `cd trips/trip-map && npm run dev -- --open false`
3. Expected: Vite starts without import-resolution errors; `photos.json` exists.

---

### Task 2: Ensure the map renders something useful

**Files:**
- Modify: `trips/trip-map/map.js`

**Steps:**
1. Add an OpenStreetMap tile layer.
2. Fix Leaflet marker icon asset loading under Vite.
3. Filter out invalid photo entries (missing lat/lng/time) before building GeoJSON.
4. Fit map bounds to available points.
5. Run: `cd trips/trip-map && npm run dev`
6. Expected: Basemap loads; markers render; popups show thumbnails.

---

### Task 3: Make manifest generation robust for demo data

**Files:**
- Modify: `trips/trip-map/scripts/worker.js`
- Modify: `trips/trip-map/scripts/generate-photos.js`

**Steps:**
1. In worker: tolerate missing EXIF date fields (choose first available) and avoid throwing on invalid dates.
2. In generator: exclude entries missing valid `latitude`, `longitude`, or `time`.
3. Run: `cd trips/trip-map && npm run gen-manifest`
4. Expected: Command succeeds; output count is non-zero; `photos.json` entries all have coords/time.

---

### Task 4: Document the local demo steps

**Files:**
- Create: `trips/trip-map/README.md`

**Steps:**
1. Add a short “run locally” section.
2. Run: `cd trips/trip-map && npm run dev`
3. Expected: Instructions match reality.

