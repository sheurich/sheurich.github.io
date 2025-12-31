export function computePlayIntervalMs(multiplier, { baseMs = 4000, minMs = 250 } = {}) {
  const m = Number(multiplier);
  if (!Number.isFinite(m) || m <= 0) return baseMs;
  return Math.max(Math.round(baseMs / m), minMs);
}

