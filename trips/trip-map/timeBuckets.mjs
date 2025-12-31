export function bucketMs(mode) {
  if (mode === "hour") return 60 * 60 * 1000;
  if (mode === "day") return 24 * 60 * 60 * 1000;
  throw new Error(`Unknown bucket mode: ${mode}`);
}

export function bucketTimeMs(timeMs, mode) {
  const ms = bucketMs(mode);
  return Math.floor(timeMs / ms) * ms;
}

export function buildBucketIndex(items, mode) {
  const buckets = new Map();
  for (const item of items) {
    const b = bucketTimeMs(item.timeMs, mode);
    const arr = buckets.get(b) ?? [];
    arr.push(item);
    buckets.set(b, arr);
  }
  const availableTimes = Array.from(buckets.keys()).sort((a, b) => a - b);
  return { buckets, availableTimes };
}
