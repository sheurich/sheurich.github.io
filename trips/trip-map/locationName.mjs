export function formatLatLng(lat, lng) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null;

  const ns = latNum >= 0 ? "N" : "S";
  const ew = lngNum >= 0 ? "E" : "W";
  return `${Math.abs(latNum).toFixed(3)}°${ns}, ${Math.abs(lngNum).toFixed(3)}°${ew}`;
}

export function pickLocationName(nominatimJson) {
  const address = nominatimJson?.address;
  if (address) {
    const locality =
      address.city ||
      address.town ||
      address.village ||
      address.hamlet ||
      address.municipality ||
      address.county;
    const state = address.state;
    if (locality && state) return `${locality}, ${state}`;
    if (locality) return locality;
  }
  if (typeof nominatimJson?.display_name === "string" && nominatimJson.display_name.trim()) {
    return nominatimJson.display_name.trim();
  }
  return null;
}

