// Import required CSS (Vite will bundle these)
import "./styles.css";
import "leaflet/dist/leaflet.css";
import "leaflet-timedimension/dist/leaflet.timedimension.control.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import L from "leaflet";
import "leaflet.markercluster";
import "leaflet-timedimension";

import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

import { bucketTimeMs, buildBucketIndex } from "./timeBuckets.mjs";
import { computePlayIntervalMs } from "./slideshowTiming.mjs";
import { buildPhotoRoute } from "./photoRoute.mjs";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

// 1. Initialize the map with TimeDimension enabled
const map = L.map("map", {
  center: [0, 0],
  zoom: 2,
  timeDimension: true,
  timeDimensionOptions: {
    // replaced once photo times are loaded
    timeInterval: "1970-01-01T00:00:00.000Z/" + new Date().toISOString(),
    period: "PT1H",
  },
  timeDimensionControl: true,
});

// Flex layouts can cause Leaflet to measure before final sizing; re-check once.
setTimeout(() => map.invalidateSize(), 0);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
}).addTo(map);

// 2. Create a MarkerClusterGroup to hold current-time markers
const clusterGroup = L.markerClusterGroup();
map.addLayer(clusterGroup);

// 3. Load and parse photos.json
fetch("photos.json")
  .then((res) => res.json())
  .then((photos) => {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) {
      console.error("Missing #sidebar element (see index.html)");
      return;
    }

    const validPhotos = photos.filter((p) => {
      const latitude = Number(p.latitude);
      const longitude = Number(p.longitude);
      const timeMs = Date.parse(p.time);
      return Number.isFinite(latitude) && Number.isFinite(longitude) && Number.isFinite(timeMs);
    });

    if (validPhotos.length === 0) {
      console.error("No valid photos found in photos.json (need latitude, longitude, and time)");
      return;
    }

    const photoMarkers = validPhotos.map((p) => {
      const timeMs = Date.parse(p.time);
      const marker = L.marker([Number(p.latitude), Number(p.longitude)]).bindPopup(`
        <div>
          <img src="${p.url}"
               alt="${p.filename}"
               style="max-width:420px; max-height:320px; width:auto; height:auto; display:block"/>
          <br/>
          ${new Date(p.time).toLocaleString()}
        </div>
      `);

      return { marker, timeMs, time: p.time, url: p.url, filename: p.filename };
    });

    const bounds = L.latLngBounds(photoMarkers.map((p) => p.marker.getLatLng()));
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.1));
    }

    const photosSorted = photoMarkers
      .slice()
      .sort((a, b) => a.timeMs - b.timeMs)
      .map((p, index) => ({ ...p, index }));

    const routeLatLngs = buildPhotoRoute(
      photosSorted.map((p) => ({
        timeMs: p.timeMs,
        latitude: p.marker.getLatLng().lat,
        longitude: p.marker.getLatLng().lng,
      }))
    ).map(([lat, lng]) => [lat, lng]);

    const routeLine = L.polyline(routeLatLngs, {
      color: "#16a34a",
      weight: 3,
      opacity: 0.6,
    }).addTo(map);
    routeLine.bindTooltip("Appalachian Trail (photo path)", { sticky: true });

    const progressLine = L.polyline([], {
      color: "#f59e0b",
      weight: 4,
      opacity: 0.9,
    }).addTo(map);

    // Highlight marker for the active slide (stays visible even if multiple markers are shown).
    const highlight = L.circleMarker([0, 0], {
      radius: 10,
      color: "#f59e0b",
      weight: 3,
      fillColor: "#fbbf24",
      fillOpacity: 0.35,
    }).addTo(map);

    let bucketMode = "day";
    let bucketsIndex = buildBucketIndex(photosSorted, bucketMode);
    for (const entries of bucketsIndex.buckets.values()) {
      entries.sort((a, b) => a.timeMs - b.timeMs);
    }

    const updateClusterForBucket = (bucketStartTimeMs) => {
      clusterGroup.clearLayers();
      const entries = bucketsIndex.buckets.get(bucketStartTimeMs) ?? [];
      entries.forEach((e) => clusterGroup.addLayer(e.marker));
      return entries;
    };

    let ignoreNextTimeLoad = false;
    let activeIndex = 0;

    const applyBucketMode = (mode) => {
      bucketMode = mode;
      bucketsIndex = buildBucketIndex(photosSorted, bucketMode);
      for (const entries of bucketsIndex.buckets.values()) {
        entries.sort((a, b) => a.timeMs - b.timeMs);
      }
      map.timeDimension.setAvailableTimes(bucketsIndex.availableTimes, "replace");

      const active = photosSorted[activeIndex];
      const bucket = bucketTimeMs(active.timeMs, bucketMode);
      ignoreNextTimeLoad = true;
      map.timeDimension.setCurrentTime(bucket);
    };

    const formatBucketLabel = (bucketStartTimeMs, mode) => {
      const start = new Date(bucketStartTimeMs);
      if (mode === "hour") {
        return start.toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "numeric",
        });
      }
      return start.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
    };

    sidebar.innerHTML = `
      <div class="p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-lg font-semibold leading-tight">Slideshow</div>
            <div id="slide-meta" class="text-xs text-slate-600 mt-1"></div>
          </div>
          <div class="flex items-center gap-2">
            <label class="text-xs text-slate-600">Bucket</label>
            <select id="bucket-mode" class="border rounded px-2 py-1 text-sm">
              <option value="hour">Hour</option>
              <option value="day" selected>Day</option>
            </select>
          </div>
        </div>

        <div class="mt-3 flex items-center gap-2">
          <button id="prev" class="border rounded px-3 py-1.5 text-sm">Prev</button>
          <button id="play" class="border rounded px-3 py-1.5 text-sm">Play</button>
          <button id="next" class="border rounded px-3 py-1.5 text-sm">Next</button>
          <div class="flex items-center gap-2 ml-auto">
            <label class="text-xs text-slate-600">Speed</label>
            <select id="speed" class="border rounded px-2 py-1 text-sm">
              <option value="1" selected>1×</option>
              <option value="2">2×</option>
              <option value="4">4×</option>
              <option value="8">8×</option>
            </select>
          </div>
        </div>

        <div class="mt-4">
          <img id="slide-image" class="w-full rounded border bg-slate-50" alt="" />
          <div id="slide-caption" class="text-sm mt-2"></div>
        </div>

        <div class="mt-4 border-t pt-3">
          <div class="flex items-baseline justify-between">
            <div class="text-sm font-medium">Current bucket</div>
            <div id="bucket-summary" class="text-xs text-slate-600"></div>
          </div>
          <div id="bucket-gallery" class="mt-2 grid grid-cols-2 gap-2"></div>
        </div>
      </div>
    `;

    const els = {
      meta: sidebar.querySelector("#slide-meta"),
      bucketMode: sidebar.querySelector("#bucket-mode"),
      prev: sidebar.querySelector("#prev"),
      play: sidebar.querySelector("#play"),
      next: sidebar.querySelector("#next"),
      speed: sidebar.querySelector("#speed"),
      image: sidebar.querySelector("#slide-image"),
      caption: sidebar.querySelector("#slide-caption"),
      bucketSummary: sidebar.querySelector("#bucket-summary"),
      gallery: sidebar.querySelector("#bucket-gallery"),
    };

    L.DomEvent.disableClickPropagation(sidebar);
    L.DomEvent.disableScrollPropagation(sidebar);

    const focusOnPhoto = (photo, { openPopup = false } = {}) => {
      highlight.setLatLng(photo.marker.getLatLng());

      // Keep zoom sticky: pan only, don't auto-zoom to reveal clusters.
      map.panTo(photo.marker.getLatLng(), { animate: true });

      if (!openPopup) return;

      // Try to reveal marker at the current zoom via spiderfying the visible parent cluster.
      map.once("moveend", () => {
        const parent =
          typeof clusterGroup.getVisibleParent === "function"
            ? clusterGroup.getVisibleParent(photo.marker)
            : null;

        if (parent && parent !== photo.marker && typeof parent.spiderfy === "function") {
          parent.spiderfy();
          setTimeout(() => photo.marker.openPopup(), 0);
          return;
        }

        photo.marker.openPopup();
      });
    };

    const renderBucketGallery = (bucketStartTimeMs, bucketEntries) => {
      els.bucketSummary.textContent = `${formatBucketLabel(bucketStartTimeMs, bucketMode)} • ${
        bucketEntries.length
      } photo${bucketEntries.length === 1 ? "" : "s"}`;

      els.gallery.innerHTML = "";
      for (const entry of bucketEntries) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className =
          "border rounded overflow-hidden bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-400";
        if (entry.index === activeIndex) {
          btn.className += " ring-2 ring-amber-400";
        }

        btn.innerHTML = `
          <img src="${entry.url}" alt="${entry.filename}" class="w-full h-28 object-cover" loading="lazy" />
          <div class="p-2">
            <div class="text-xs font-medium truncate">${entry.filename}</div>
            <div class="text-[11px] text-slate-600 mt-0.5">${new Date(entry.time).toLocaleString()}</div>
          </div>
        `;

        btn.addEventListener("click", () => {
          setActiveIndex(entry.index, { openPopup: true });
        });

        els.gallery.appendChild(btn);
      }
    };

    const renderActive = ({ openPopup = false } = {}) => {
      const active = photosSorted[activeIndex];
      const bucketStart = bucketTimeMs(active.timeMs, bucketMode);
      const bucketEntries = bucketsIndex.buckets.get(bucketStart) ?? [];
      updateClusterForBucket(bucketStart);

      if (map.timeDimension.getCurrentTime() !== bucketStart) {
        ignoreNextTimeLoad = true;
        map.timeDimension.setCurrentTime(bucketStart);
      }

      // Route progress line: connect photos up to the current slide.
      progressLine.setLatLngs(photosSorted.slice(0, activeIndex + 1).map((p) => p.marker.getLatLng()));

      els.meta.textContent = `${activeIndex + 1} / ${photosSorted.length}`;
      els.image.src = active.url;
      els.image.alt = active.filename;
      els.caption.innerHTML = `
        <div class="font-medium">${active.filename}</div>
        <div class="text-xs text-slate-600 mt-0.5">${new Date(active.time).toLocaleString()}</div>
      `;

      renderBucketGallery(bucketStart, bucketEntries);
      focusOnPhoto(active, { openPopup });
    };

    const setActiveIndex = (index, opts) => {
      const next = Math.min(Math.max(index, 0), photosSorted.length - 1);
      activeIndex = next;
      renderActive(opts);
    };

    // TimeDimension → slideshow sync (scrubbing the bottom-left control)
    map.timeDimension.on("timeload", (e) => {
      if (ignoreNextTimeLoad) {
        ignoreNextTimeLoad = false;
        return;
      }
      const bucketEntries = bucketsIndex.buckets.get(e.time) ?? [];
      if (bucketEntries.length > 0) {
        setActiveIndex(bucketEntries[0].index);
      }
    });

    // Slideshow controls
    let isPlaying = false;
    let playIntervalId = null;

    const stop = () => {
      isPlaying = false;
      if (playIntervalId) clearInterval(playIntervalId);
      playIntervalId = null;
      els.play.textContent = "Play";
    };

    const start = () => {
      stop();
      isPlaying = true;
      els.play.textContent = "Pause";
      const intervalMs = computePlayIntervalMs(els.speed.value);
      playIntervalId = setInterval(() => {
        setActiveIndex((activeIndex + 1) % photosSorted.length);
      }, intervalMs);
    };

    els.prev.addEventListener("click", () => setActiveIndex((activeIndex - 1 + photosSorted.length) % photosSorted.length));
    els.next.addEventListener("click", () => setActiveIndex((activeIndex + 1) % photosSorted.length));
    els.play.addEventListener("click", () => (isPlaying ? stop() : start()));
    els.speed.addEventListener("change", () => {
      if (isPlaying) start();
    });

    els.bucketMode.addEventListener("change", (e) => {
      applyBucketMode(e.target.value);
      renderActive();
    });

    // Initial setup
    map.timeDimension.setAvailableTimes(bucketsIndex.availableTimes, "replace");
    ignoreNextTimeLoad = true;
    map.timeDimension.setCurrentTime(bucketTimeMs(photosSorted[0].timeMs, bucketMode));
    renderActive();
  })
  .catch((err) => console.error("Failed to load photos.json:", err));
