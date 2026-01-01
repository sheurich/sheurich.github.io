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
import { formatLatLng, pickLocationName } from "./locationName.mjs";

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

    const sidebarToggle = document.getElementById("sidebar-toggle");
    const sidebarBackdrop = document.getElementById("sidebar-backdrop");
    const desktopMq = window.matchMedia("(min-width: 1024px)");

    let isSheetOpen = false;
    const setSheetOpen = (open) => {
      if (desktopMq.matches) {
        isSheetOpen = false;
        sidebarBackdrop?.classList.add("hidden");
        sidebar.setAttribute("aria-hidden", "false");
        sidebarToggle?.setAttribute("aria-expanded", "false");
        if (sidebarToggle) sidebarToggle.textContent = "Slideshow";
        return;
      }

      isSheetOpen = open;
      sidebar.classList.toggle("translate-y-full", !open);
      sidebarBackdrop?.classList.toggle("hidden", !open);
      sidebar.setAttribute("aria-hidden", String(!open));
      sidebarToggle?.setAttribute("aria-expanded", String(open));
      if (sidebarToggle) sidebarToggle.textContent = open ? "Close" : "Slideshow";

      // Best-effort: ensure Leaflet measures correctly after UI changes.
      setTimeout(() => map.invalidateSize(), 0);
    };

    const toggleSheet = () => setSheetOpen(!isSheetOpen);
    const openSheet = () => setSheetOpen(true);
    const closeSheet = () => setSheetOpen(false);

    sidebarToggle?.addEventListener("click", toggleSheet);
    sidebarBackdrop?.addEventListener("click", closeSheet);
    desktopMq.addEventListener("change", () => setSheetOpen(false));
    setSheetOpen(false);

    const createLightbox = () => {
      const overlay = document.createElement("div");
      overlay.id = "photo-lightbox";
      overlay.className = "fixed inset-0 z-[2000] hidden items-center justify-center bg-black/70 p-4";
      overlay.setAttribute("aria-hidden", "true");
      overlay.innerHTML = `
        <div class="relative w-full max-w-[1200px]">
          <button id="photo-lightbox-close" type="button"
            class="absolute -top-2 -right-2 rounded-full bg-white/90 p-2 text-slate-900 shadow ring-1 ring-black/10 hover:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            aria-label="Close photo">
            <span aria-hidden="true">×</span>
          </button>
          <img id="photo-lightbox-image" class="mx-auto max-h-[90vh] max-w-full w-auto rounded-lg bg-black/10 object-contain shadow-2xl" alt="" />
          <div id="photo-lightbox-caption" class="mt-2 text-center text-xs text-white/80"></div>
        </div>
      `;
      document.body.appendChild(overlay);

      const img = overlay.querySelector("#photo-lightbox-image");
      const caption = overlay.querySelector("#photo-lightbox-caption");
      const closeBtn = overlay.querySelector("#photo-lightbox-close");

      let open = false;
      const close = () => {
        if (!open) return;
        open = false;
        overlay.classList.add("hidden");
        overlay.classList.remove("flex");
        overlay.setAttribute("aria-hidden", "true");
        document.body.classList.remove("overflow-hidden");
      };

      const show = ({ src, alt, captionText }) => {
        open = true;
        img.src = src;
        img.alt = alt || "";
        caption.textContent = captionText || "";
        overlay.classList.remove("hidden");
        overlay.classList.add("flex");
        overlay.setAttribute("aria-hidden", "false");
        document.body.classList.add("overflow-hidden");
      };

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close();
      });
      closeBtn.addEventListener("click", close);

      return { show, close, isOpen: () => open };
    };

    const lightbox = createLightbox();
    window.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (lightbox.isOpen()) {
        lightbox.close();
        return;
      }
      if (isSheetOpen) closeSheet();
    });

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
      const marker = L.marker([Number(p.latitude), Number(p.longitude)]);

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
      <div class="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div class="p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-base font-semibold leading-tight">Slideshow</div>
              <div id="slide-meta" class="text-xs text-slate-600 mt-1"></div>
            </div>
            <button id="sheet-close" type="button"
              class="rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400 lg:hidden"
              aria-label="Close panel">
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <div class="mt-3 grid grid-cols-2 gap-2">
            <label class="flex flex-col gap-1">
              <span class="text-[11px] font-medium text-slate-600">Bucket</span>
              <select id="bucket-mode"
                class="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                <option value="hour">Hour</option>
                <option value="day" selected>Day</option>
              </select>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-[11px] font-medium text-slate-600">Speed</span>
              <select id="speed"
                class="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                <option value="1" selected>1×</option>
                <option value="2">2×</option>
                <option value="4">4×</option>
                <option value="8">8×</option>
              </select>
            </label>
          </div>

          <div class="mt-3 flex items-center gap-2">
            <button id="prev"
              class="flex-1 h-10 rounded-md border border-slate-200 bg-white text-sm font-medium shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-400">
              Prev
            </button>
            <button id="play"
              class="flex-1 h-10 rounded-md bg-slate-900 text-white text-sm font-medium shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400">
              Play
            </button>
            <button id="next"
              class="flex-1 h-10 rounded-md border border-slate-200 bg-white text-sm font-medium shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-400">
              Next
            </button>
          </div>
        </div>
      </div>

      <div class="p-4">
        <div>
          <div id="slide-location" class="text-base font-semibold leading-tight"></div>
          <div id="slide-time" class="text-xs text-slate-600 mt-0.5"></div>
        </div>

        <button id="slide-image-button" type="button"
          class="mt-3 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
          aria-label="Open photo">
          <img id="slide-image" class="block w-full max-h-[62vh] object-contain" alt="" />
        </button>

        <div class="mt-4 border-t pt-3">
          <div class="flex items-baseline justify-between gap-3">
            <div class="text-sm font-medium">Current bucket</div>
            <div id="bucket-summary" class="text-xs text-slate-600 text-right"></div>
          </div>
          <div id="bucket-gallery" class="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3"></div>
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
      location: sidebar.querySelector("#slide-location"),
      time: sidebar.querySelector("#slide-time"),
      imageButton: sidebar.querySelector("#slide-image-button"),
      image: sidebar.querySelector("#slide-image"),
      bucketSummary: sidebar.querySelector("#bucket-summary"),
      gallery: sidebar.querySelector("#bucket-gallery"),
      sheetClose: sidebar.querySelector("#sheet-close"),
    };

    L.DomEvent.disableClickPropagation(sidebar);
    L.DomEvent.disableScrollPropagation(sidebar);

    els.sheetClose?.addEventListener("click", closeSheet);

    els.imageButton?.addEventListener("click", () => {
      const active = photosSorted[activeIndex];
      lightbox.show({
        src: active.url,
        alt: active.filename,
        captionText: `${els.location.textContent || active.filename} • ${els.time.textContent || ""}`.trim(),
      });
    });

    const focusOnPhoto = (photo) => {
      highlight.setLatLng(photo.marker.getLatLng());

      // Keep zoom sticky: pan only, don't auto-zoom to reveal clusters.
      map.panTo(photo.marker.getLatLng(), { animate: true });
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
          "group relative overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400";
        btn.title = `${entry.filename} • ${new Date(entry.time).toLocaleString()}`;
        if (entry.index === activeIndex) {
          btn.className += " ring-2 ring-amber-400 border-amber-300";
        }

        btn.innerHTML = `
          <img src="${entry.url}" alt="${entry.filename}" class="h-20 w-full object-cover" loading="lazy" />
          <div class="absolute inset-x-0 bottom-0 bg-black/45 px-1 py-0.5 text-[10px] text-white/90 opacity-0 transition-opacity group-hover:opacity-100">
            ${new Date(entry.time).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </div>
        `;

        btn.addEventListener("click", () => {
          stop();
          openSheet();
          setActiveIndex(entry.index);
        });

        els.gallery.appendChild(btn);
      }
    };

    const renderActive = () => {
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
      els.time.textContent = new Date(active.time).toLocaleString();

      const latlng = active.marker.getLatLng();
      const fallback = formatLatLng(latlng.lat, latlng.lng) ?? "";
      els.location.textContent = fallback || "Unknown location";

      renderBucketGallery(bucketStart, bucketEntries);
      focusOnPhoto(active);

      // Best-effort reverse geocode (cached) to display a friendly location name.
      // This runs client-side and can be throttled/cached by the browser; fallback remains coords.
      const key = `${latlng.lat.toFixed(4)},${latlng.lng.toFixed(4)}`;
      const cacheKey = "trip-map:nominatim-cache:v1";
      let cache = {};
      try {
        cache = JSON.parse(localStorage.getItem(cacheKey) || "{}");
      } catch {
        cache = {};
      }

      if (cache[key]) {
        els.location.textContent = cache[key];
        return;
      }

      if (!window.__tripMapNominatim) {
        window.__tripMapNominatim = { inFlight: null, lastAt: 0 };
      }
      const state = window.__tripMapNominatim;
      if (state.inFlight) state.inFlight.abort();
      state.inFlight = new AbortController();
      const signal = state.inFlight.signal;

      const now = Date.now();
      const waitMs = Math.max(0, 1000 - (now - state.lastAt));
      setTimeout(async () => {
        try {
          state.lastAt = Date.now();
          const url = new URL("https://nominatim.openstreetmap.org/reverse");
          url.searchParams.set("format", "jsonv2");
          url.searchParams.set("lat", String(latlng.lat));
          url.searchParams.set("lon", String(latlng.lng));
          url.searchParams.set("zoom", "10");
          url.searchParams.set("addressdetails", "1");

          const res = await fetch(url, {
            signal,
            headers: { Accept: "application/json" },
          });
          if (!res.ok) return;
          const json = await res.json();
          const name = pickLocationName(json);
          if (!name) return;
          cache[key] = name;
          try {
            localStorage.setItem(cacheKey, JSON.stringify(cache));
          } catch {
            // ignore storage quota
          }
          if (activeIndex === active.index) {
            els.location.textContent = name;
          }
        } catch (e) {
          // ignore abort/network failures; keep fallback
        }
      }, waitMs);
    };

    const setActiveIndex = (index) => {
      const next = Math.min(Math.max(index, 0), photosSorted.length - 1);
      activeIndex = next;
      renderActive();
    };

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

    // Marker click selects the *bucket* (not a specific photo).
    for (const entry of photosSorted) {
      entry.marker.on("click", () => {
        stop();
        openSheet();

        const bucketStart = bucketTimeMs(entry.timeMs, bucketMode);
        const bucketEntries = bucketsIndex.buckets.get(bucketStart) ?? [];
        if (bucketEntries.length > 0) {
          setActiveIndex(bucketEntries[0].index);
        }
      });
    }

    // TimeDimension → slideshow sync (scrubbing the bottom-left control)
    map.timeDimension.on("timeload", (e) => {
      if (ignoreNextTimeLoad) {
        ignoreNextTimeLoad = false;
        return;
      }

      // User scrubbed the timeline: stop autoplay so UI doesn’t feel “out of sync”.
      stop();

      const bucketEntries = bucketsIndex.buckets.get(e.time) ?? [];
      if (bucketEntries.length > 0) {
        setActiveIndex(bucketEntries[0].index);
      }
    });

    // Initial setup
    map.timeDimension.setAvailableTimes(bucketsIndex.availableTimes, "replace");
    ignoreNextTimeLoad = true;
    map.timeDimension.setCurrentTime(bucketTimeMs(photosSorted[0].timeMs, bucketMode));
    renderActive();
  })
  .catch((err) => console.error("Failed to load photos.json:", err));
