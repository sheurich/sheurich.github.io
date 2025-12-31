# Trip Map Current-Bucket Gallery Implementation Plan

> **For Codex:** Implement directly in this workspace.

**Goal:** Add a “current bucket” gallery (thumbnails/list) that updates with time navigation; clicking an item pans/zooms to the marker and opens its popup.

**Architecture:** Reuse the existing bucketing index in `trips/trip-map/map.js`. Extend the top-right Time UX control to render the list for the active bucket. Use `clusterGroup.zoomToShowLayer(marker, ...)` for reliable focusing when markers are clustered.

**Tech Stack:** Leaflet, Leaflet.TimeDimension, Leaflet.markercluster.

---

### Task 1: Add gallery UI to the Time UX panel

**Files:**
- Modify: `trips/trip-map/map.js`

**Steps:**
1. Store per-photo metadata (filename/url/time) alongside each Leaflet marker.
2. In the Time UX control, add a scrollable list container.
3. On `timeload`, render the list for the current bucket.
4. On click, call `clusterGroup.zoomToShowLayer(marker, () => marker.openPopup())`.

**Verify:**
- Run: `cd trips/trip-map && npm run dev`
- Expected: list updates as you step/play; clicking an item focuses and opens its popup.

---

### Task 2: Document the gallery behavior

**Files:**
- Modify: `trips/trip-map/README.md`

