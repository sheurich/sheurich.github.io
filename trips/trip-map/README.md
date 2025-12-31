# Trip Map (local demo)

## Run

```bash
cd trips/trip-map
npm ci
npm run dev
```

Then open the URL Vite prints (usually `http://127.0.0.1:5173/`).

## Notes

- `npm run dev` regenerates `photos.json` from the images in `photos/` via `scripts/generate-photos.js`.
- Photos without valid GPS + time EXIF data are skipped (they won’t appear on the map).
- Time controls:
  - Bottom-left: Leaflet.TimeDimension default timeline.
  - Right sidebar: slideshow that advances photo-by-photo; bucket mode (Hour/Day) controls what markers are shown and what appears in “Current bucket”.
