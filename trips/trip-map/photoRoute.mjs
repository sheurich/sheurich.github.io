export function buildPhotoRoute(photos) {
  const sorted = photos.slice().sort((a, b) => a.timeMs - b.timeMs);
  const route = [];
  let last = null;

  for (const p of sorted) {
    const point = [Number(p.latitude), Number(p.longitude)];
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue;
    if (last && last[0] === point[0] && last[1] === point[1]) continue;
    route.push(point);
    last = point;
  }

  return route;
}

