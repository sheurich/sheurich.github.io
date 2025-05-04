// Import required CSS (Vite will bundle these)
import "leaflet/dist/leaflet.css";
import "leaflet-timedimension/dist/leaflet.timedimension.control.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import L from "leaflet";
import "leaflet.markercluster";
import "leaflet-timedimension";

// 1. Initialize the map with TimeDimension enabled
const map = L.map("map", {
  center: [0, 0],
  zoom: 2,
  timeDimension: true,
  timeDimensionOptions: {
    // from epoch to now, stepping 1 hour
    timeInterval: "PT0H/" + new Date().toISOString(),
    period: "PT1H",
  },
  timeDimensionControl: true,
});

// 2. Create a MarkerClusterGroup to hold current-time markers
const clusterGroup = L.markerClusterGroup();
map.addLayer(clusterGroup);

// 3. Load and parse photos.json
fetch("photos.json")
  .then((res) => res.json())
  .then((photos) => {
    // Build GeoJSON FeatureCollection
    const geojson = {
      type: "FeatureCollection",
      features: photos.map((p) => ({
        type: "Feature",
        properties: {
          time: p.time,
          url: p.url,
          filename: p.filename,
        },
        geometry: {
          type: "Point",
          coordinates: [p.longitude, p.latitude],
        },
      })),
    };

    // 4. Create a GeoJSON layer that binds a popup to each marker
    const geoJsonLayer = L.geoJson(geojson, {
      pointToLayer: (feature, latlng) =>
        L.marker(latlng).bindPopup(`
          <div>
            <img src="${feature.properties.url}"
                 alt="${feature.properties.filename}"
                 style="max-width:150px"/>
            <br/>
            ${new Date(feature.properties.time).toLocaleString()}
          </div>
        `),
    });

    // 5. Wrap the GeoJSON layer in a TimeDimension layer
    const tdLayer = L.timeDimension.layer.geoJson(geoJsonLayer, {
      updateTimeDimension: true,
      updateTimeDimensionMode: "replace",
      addlastPoint: false,
      waitForReady: true,
    });

    // 6. On each time change, clear & re‑cluster only the features for that time
    tdLayer.on("timeload", () => {
      const currentTs = tdLayer.timeDimension.getCurrentTime();
      clusterGroup.clearLayers();
      geoJsonLayer
        .getLayers()
        .filter((m) => m.feature.properties.time === currentTs)
        .forEach((m) => clusterGroup.addLayer(m));
    });

    // 7. Add to map
    tdLayer.addTo(map);
  })
  .catch((err) => console.error("Failed to load photos.json:", err));
