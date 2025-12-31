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
               style="max-width:150px; height:auto"/>
          <br/>
          ${new Date(p.time).toLocaleString()}
        </div>
      `);

      return { marker, timeMs };
    });

    const bounds = L.latLngBounds(photoMarkers.map((p) => p.marker.getLatLng()));
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.1));
    }

    const BUCKET_MS_BY_MODE = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
    };

    const formatBucketLabel = (bucketTimeMs, mode) => {
      const start = new Date(bucketTimeMs);
      const end = new Date(bucketTimeMs + BUCKET_MS_BY_MODE[mode]);
      if (mode === "hour") {
        return start.toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "numeric",
        });
      }
      return `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;
    };

    const getBucketTimeMs = (timeMs, mode) => {
      const bucketMs = BUCKET_MS_BY_MODE[mode];
      return Math.floor(timeMs / bucketMs) * bucketMs;
    };

    const computeBuckets = (mode) => {
      const buckets = new Map();
      for (const { marker, timeMs } of photoMarkers) {
        const bucketTimeMs = getBucketTimeMs(timeMs, mode);
        const markers = buckets.get(bucketTimeMs) ?? [];
        markers.push(marker);
        buckets.set(bucketTimeMs, markers);
      }
      const availableTimes = Array.from(buckets.keys()).sort((a, b) => a - b);
      return { buckets, availableTimes };
    };

    let bucketMode = "hour";
    let bucketsIndex = computeBuckets(bucketMode);

    const updateClusterForTime = (timeMs) => {
      clusterGroup.clearLayers();
      const markers = bucketsIndex.buckets.get(timeMs) ?? [];
      markers.forEach((m) => clusterGroup.addLayer(m));
      return markers.length;
    };

    const applyBucketMode = (mode) => {
      bucketMode = mode;
      bucketsIndex = computeBuckets(bucketMode);
      map.timeDimension.setAvailableTimes(bucketsIndex.availableTimes, "replace");
      map.timeDimension.setCurrentTime(bucketsIndex.availableTimes[0]);
    };

    // UI: bucket selector + summary
    const TimeUxControl = L.Control.extend({
      options: { position: "topright" },
      onAdd() {
        const container = L.DomUtil.create(
          "div",
          "leaflet-bar bg-white/90 backdrop-blur px-3 py-2 text-sm shadow"
        );

        container.innerHTML = `
          <div class="flex items-center gap-2">
            <label class="font-medium">Bucket</label>
            <select id="bucket-mode" class="border rounded px-2 py-1 text-sm">
              <option value="hour" selected>Hour</option>
              <option value="day">Day</option>
            </select>
          </div>
          <div class="mt-2 flex items-center gap-2">
            <button id="play-toggle" class="border rounded px-2 py-1 text-sm">
              Play
            </button>
            <label class="text-xs text-slate-600">Speed</label>
            <select id="play-speed" class="border rounded px-2 py-1 text-sm">
              <option value="1" selected>1×</option>
              <option value="2">2×</option>
              <option value="4">4×</option>
              <option value="8">8×</option>
            </select>
          </div>
          <div class="mt-2 text-xs text-slate-700">
            <div id="bucket-label"></div>
            <div id="bucket-count" class="mt-0.5"></div>
          </div>
        `;

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        const select = container.querySelector("#bucket-mode");
        const playToggle = container.querySelector("#play-toggle");
        const playSpeed = container.querySelector("#play-speed");
        const label = container.querySelector("#bucket-label");
        const count = container.querySelector("#bucket-count");

        const renderSummary = (timeMs) => {
          const n = updateClusterForTime(timeMs);
          label.textContent = formatBucketLabel(timeMs, bucketMode);
          count.textContent = `${n} photo${n === 1 ? "" : "s"}`;
        };

        let isPlaying = false;
        let intervalId = null;

        const stop = () => {
          isPlaying = false;
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          playToggle.textContent = "Play";
        };

        const start = () => {
          stop();
          isPlaying = true;
          playToggle.textContent = "Pause";

          const stepsPerSecond = Number(playSpeed.value) || 1;
          const intervalMs = Math.max(1000 / stepsPerSecond, 50);

          intervalId = setInterval(() => {
            if (map.timeDimension.isLoading()) return;
            map.timeDimension.nextTime(1, true);
          }, intervalMs);
        };

        select.addEventListener("change", (e) => {
          applyBucketMode(e.target.value);
          renderSummary(map.timeDimension.getCurrentTime());
        });

        playToggle.addEventListener("click", () => {
          if (isPlaying) stop();
          else start();
        });

        playSpeed.addEventListener("change", () => {
          if (isPlaying) start();
        });

        map.timeDimension.on("timeload", (e) => renderSummary(e.time));

        // initial
        setTimeout(() => renderSummary(map.timeDimension.getCurrentTime()), 0);

        return container;
      },
    });

    map.addControl(new TimeUxControl());

    applyBucketMode(bucketMode);

    // Render initial bucket so the time controls visibly affect the map.
    updateClusterForTime(bucketsIndex.availableTimes[0]);
  })
  .catch((err) => console.error("Failed to load photos.json:", err));
