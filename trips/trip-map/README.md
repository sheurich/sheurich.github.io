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
  - Top-right: Hour/Day bucketing + current bucket count + play/pause with speed.
  - Gallery: shows photos in the current bucket; click an item to zoom to it and open the popup.
