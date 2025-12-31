# Trip Map Time UX Improvements Implementation Plan

> **For Codex:** Implement directly in this workspace (subagents/worktrees not available here).

**Goal:** Make the time UI feel meaningful: choose bucketing granularity, show “what’s currently visible”, and provide smooth playback controls.

**Architecture:** Keep `map.timeDimension` as the single source of truth for time state. Build a precomputed index of markers by bucket time for each granularity. A small Leaflet control drives bucket selection + play/pause and updates the marker cluster on `timeload`.

**Tech Stack:** Leaflet, Leaflet.TimeDimension, Leaflet.markercluster, Vite.

---

### Task 1: Add time UX control + state

**Files:**
- Modify: `trips/trip-map/map.js`

**Step 1: Implement UI state + helper functions**
- Add `bucketMode` (`hour`/`day`), playback state, and marker index per bucket.
- Add helper `formatBucketLabel()` and `computeBuckets()` functions.

**Step 2: Implement Leaflet control**
- Add a Leaflet control (top-right) with:
  - Bucket selector: Hour / Day
  - Current bucket label
  - “Photos in bucket” count
  - Play/Pause button
  - Speed selector (steps/second)

**Step 3: Wire to map**
- On bucket mode change: update `map.timeDimension.setAvailableTimes(...)` and reset to first available time.
- On `map.timeDimension` `timeload`: update cluster + UI label/count.

**Step 4: Verify locally**
- Run: `cd trips/trip-map && npm run dev`
- Expected: changing bucket mode changes which markers are visible; play advances through time.

---

### Task 2: Update docs

**Files:**
- Modify: `trips/trip-map/README.md`

**Steps:**
1. Document hour/day toggle and playback.
2. Run: `cd trips/trip-map && npm run dev`
3. Expected: README matches the UI.

