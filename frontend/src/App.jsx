import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap
} from "react-leaflet";
import L from "leaflet";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";

const defaultRider = {
  riderId: "rider_001",
  pickupName: "Bhimtal",
  dropName: "Nainital",
  pickupLat: 29.3446,
  pickupLng: 79.5644,
  dropLat: 29.3806,
  dropLng: 79.4636
};

const defaultDriver = {
  driverId: "driver_001",
  lat: 29.3446,
  lng: 79.5644
};

const defaultMarkerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function buildMapLink(pickupLat, pickupLng, dropLat, dropLng) {
  return `https://www.google.com/maps/dir/?api=1&origin=${pickupLat},${pickupLng}&destination=${dropLat},${dropLng}&travelmode=driving`;
}

function buildDriverMapLink(driverLat, driverLng, pickupLat, pickupLng, dropLat, dropLng) {
  return `https://www.google.com/maps/dir/?api=1&origin=${driverLat},${driverLng}&destination=${dropLat},${dropLng}&waypoints=${pickupLat},${pickupLng}&travelmode=driving`;
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : "-";
}

function isValidLatLng(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

async function geocodePlace(name) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
      name
    )}`
  );
  if (!response.ok) {
    throw new Error(`Geocoding failed (${response.status})`);
  }
  const results = await response.json();
  if (!results.length) {
    throw new Error(`No location found for "${name}"`);
  }
  return {
    lat: Number(results[0].lat),
    lng: Number(results[0].lon),
    label: results[0].display_name
  };
}

async function fetchRoute(coords) {
  const formatted = coords.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${formatted}?overview=full&geometries=geojson`
  );
  if (!response.ok) {
    throw new Error(`Route fetch failed (${response.status})`);
  }
  const payload = await response.json();
  if (!payload.routes?.length) {
    throw new Error("No route found for those points.");
  }
  const route = payload.routes[0];
  return {
    coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60
  };
}

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds || !bounds.length) return;
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [bounds, map]);
  return null;
}

export default function App() {
  const [tab, setTab] = useState("rider");
  const [riderForm, setRiderForm] = useState(defaultRider);
  const [riderResult, setRiderResult] = useState(null);
  const [riderError, setRiderError] = useState("");
  const [riderGeoStatus, setRiderGeoStatus] = useState("");
  const [riderGeoError, setRiderGeoError] = useState("");
  const [useManualCoords, setUseManualCoords] = useState(false);
  const [riderRoute, setRiderRoute] = useState(null);
  const [riderRouteError, setRiderRouteError] = useState("");
  const [livePricingEnabled, setLivePricingEnabled] = useState(true);
  const [riderStreamStatus, setRiderStreamStatus] = useState("");
  const [riderStreamError, setRiderStreamError] = useState("");

  const [driverForm, setDriverForm] = useState(defaultDriver);
  const [driverBatch, setDriverBatch] = useState(`[
  {
    "driverId": "driver_101",
    "lat": 29.3446,
    "lng": 79.5644
  },
  {
    "driverId": "driver_102",
    "lat": 29.3446,
    "lng": 79.5644
  }
]`);
  const [driverStatus, setDriverStatus] = useState("");

  const [availabilityForm, setAvailabilityForm] = useState({
    lat: 29.3446,
    lng: 79.5644
  });
  const [availabilityResult, setAvailabilityResult] = useState(null);
  const [availabilityError, setAvailabilityError] = useState("");
  const [selectedRide, setSelectedRide] = useState(null);
  const [driverRoute, setDriverRoute] = useState(null);
  const [driverRouteError, setDriverRouteError] = useState("");

  const mapLink = useMemo(() => {
    if (!riderResult) return "";
    return buildMapLink(
      riderForm.pickupLat,
      riderForm.pickupLng,
      riderForm.dropLat,
      riderForm.dropLng
    );
  }, [riderForm, riderResult]);

  const riderMapBounds = useMemo(() => {
    if (!riderRoute?.coordinates?.length) return null;
    return L.latLngBounds(riderRoute.coordinates);
  }, [riderRoute]);

  const riderMapCenter = useMemo(() => {
    if (isValidLatLng(riderForm.pickupLat, riderForm.pickupLng)) {
      return [riderForm.pickupLat, riderForm.pickupLng];
    }
    return [defaultRider.pickupLat, defaultRider.pickupLng];
  }, [riderForm.pickupLat, riderForm.pickupLng]);

  const driverMapBounds = useMemo(() => {
    if (!driverRoute?.coordinates?.length) return null;
    return L.latLngBounds(driverRoute.coordinates);
  }, [driverRoute]);

  const driverMapCenter = useMemo(() => {
    if (isValidLatLng(driverForm.lat, driverForm.lng)) {
      return [driverForm.lat, driverForm.lng];
    }
    return [defaultDriver.lat, defaultDriver.lng];
  }, [driverForm.lat, driverForm.lng]);

  useEffect(() => {
    if (
      !isValidLatLng(riderForm.pickupLat, riderForm.pickupLng) ||
      !isValidLatLng(riderForm.dropLat, riderForm.dropLng)
    ) {
      setRiderRoute(null);
      return;
    }
    let cancelled = false;
    setRiderRouteError("");
    fetchRoute([
      [riderForm.pickupLat, riderForm.pickupLng],
      [riderForm.dropLat, riderForm.dropLng]
    ])
      .then((route) => {
        if (!cancelled) setRiderRoute(route);
      })
      .catch((error) => {
        if (!cancelled) {
          setRiderRouteError(error.message);
          setRiderRoute(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [riderForm.pickupLat, riderForm.pickupLng, riderForm.dropLat, riderForm.dropLng]);

  useEffect(() => {
    if (!livePricingEnabled) {
      setRiderStreamStatus("");
      setRiderStreamError("");
      return undefined;
    }
    if (
      !isValidLatLng(riderForm.pickupLat, riderForm.pickupLng) ||
      !isValidLatLng(riderForm.dropLat, riderForm.dropLng)
    ) {
      setRiderStreamStatus("");
      return undefined;
    }

    const params = new URLSearchParams({
      pickupLat: riderForm.pickupLat,
      pickupLng: riderForm.pickupLng,
      dropLat: riderForm.dropLat,
      dropLng: riderForm.dropLng,
      riderId: riderForm.riderId || "rider_live"
    });
    if (riderForm.pickupName) params.append("pickupName", riderForm.pickupName);
    if (riderForm.dropName) params.append("dropName", riderForm.dropName);

    const source = new EventSource(`${API_BASE}/rider/stream?${params.toString()}`);
    setRiderStreamStatus("Live pricing active.");
    setRiderStreamError("");

    const handlePrice = (event) => {
      try {
        const data = JSON.parse(event.data);
        setRiderResult(data);
      } catch (error) {
        setRiderStreamError("Live update parse error.");
      }
    };

    const handleError = () => {
      setRiderStreamError("Live pricing connection lost.");
      source.close();
    };

    source.addEventListener("price", handlePrice);
    source.addEventListener("error", handleError);

    return () => {
      source.removeEventListener("price", handlePrice);
      source.removeEventListener("error", handleError);
      source.close();
    };
  }, [
    livePricingEnabled,
    riderForm.pickupLat,
    riderForm.pickupLng,
    riderForm.dropLat,
    riderForm.dropLng,
    riderForm.riderId,
    riderForm.pickupName,
    riderForm.dropName
  ]);

  useEffect(() => {
    if (
      !selectedRide ||
      !isValidLatLng(driverForm.lat, driverForm.lng) ||
      !isValidLatLng(selectedRide.pickupLat, selectedRide.pickupLng) ||
      !isValidLatLng(selectedRide.dropLat, selectedRide.dropLng)
    ) {
      setDriverRoute(null);
      return;
    }
    let cancelled = false;
    setDriverRouteError("");
    fetchRoute([
      [driverForm.lat, driverForm.lng],
      [selectedRide.pickupLat, selectedRide.pickupLng],
      [selectedRide.dropLat, selectedRide.dropLng]
    ])
      .then((route) => {
        if (!cancelled) setDriverRoute(route);
      })
      .catch((error) => {
        if (!cancelled) {
          setDriverRouteError(error.message);
          setDriverRoute(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [driverForm.lat, driverForm.lng, selectedRide]);

  async function handleGeocodeLocations() {
    setRiderGeoStatus("");
    setRiderGeoError("");
    setRiderRouteError("");
    try {
      const [pickup, drop] = await Promise.all([
        geocodePlace(riderForm.pickupName),
        geocodePlace(riderForm.dropName)
      ]);
      setRiderForm((prev) => ({
        ...prev,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropLat: drop.lat,
        dropLng: drop.lng
      }));
      setRiderGeoStatus("Coordinates updated from map search.");
    } catch (error) {
      setRiderGeoError(error.message);
    }
  }

  async function handleBookRide(event) {
    event.preventDefault();
    setRiderError("");
    setRiderResult(null);
    try {
      const response = await fetch(`${API_BASE}/rider/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(riderForm)
      });
      if (!response.ok) {
        throw new Error(`Booking failed (${response.status})`);
      }
      const payload = await response.json();
      setRiderResult(payload);
    } catch (error) {
      setRiderError(error.message);
    }
  }

  async function handleDriverUpdate(event) {
    event.preventDefault();
    setDriverStatus("");
    try {
      const response = await fetch(`${API_BASE}/driver/location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId: driverForm.driverId,
          lat: Number(driverForm.lat),
          lng: Number(driverForm.lng)
        })
      });
      if (!response.ok) {
        throw new Error(`Update failed (${response.status})`);
      }
      setDriverStatus("Driver location sent.");
    } catch (error) {
      setDriverStatus(error.message);
    }
  }

  async function handleBatchUpload() {
    setDriverStatus("");
    try {
      const parsed = JSON.parse(driverBatch);
      if (!Array.isArray(parsed)) {
        throw new Error("Batch input must be a JSON array.");
      }
      const response = await fetch(`${API_BASE}/driver/location/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed)
      });
      if (!response.ok) {
        throw new Error(`Batch update failed (${response.status})`);
      }
      const payload = await response.json();
      setDriverStatus(`Batch accepted: ${payload.count}`);
    } catch (error) {
      setDriverStatus(error.message);
    }
  }

  async function handleAvailability(event) {
    event.preventDefault();
    setAvailabilityError("");
    setAvailabilityResult(null);
    try {
      const response = await fetch(
        `${API_BASE}/driver/availability?lat=${availabilityForm.lat}&lng=${availabilityForm.lng}`
      );
      if (!response.ok) {
        throw new Error(`Availability failed (${response.status})`);
      }
      const payload = await response.json();
      setAvailabilityResult(payload);
    } catch (error) {
      setAvailabilityError(error.message);
    }
  }

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>Surge Pricing Engine</h1>
        </div>
        <div className="tabs">
          <button
            className={tab === "rider" ? "tab active" : "tab"}
            onClick={() => setTab("rider")}
          >
            Rider View
          </button>
          <button
            className={tab === "driver" ? "tab active" : "tab"}
            onClick={() => setTab("driver")}
          >
            Driver View
          </button>
        </div>
      </header>

      {tab === "rider" && (
        <section className="card">
          <h2>Rider Dashboard</h2>
          <form className="grid" onSubmit={handleBookRide}>
            <label>
              From (name)
              <input
                value={riderForm.pickupName}
                onChange={(e) => setRiderForm({ ...riderForm, pickupName: e.target.value })}
              />
            </label>
            <label>
              To (name)
              <input
                value={riderForm.dropName}
                onChange={(e) => setRiderForm({ ...riderForm, dropName: e.target.value })}
              />
            </label>
            <div className="full inline-row">
              <button type="button" className="secondary" onClick={handleGeocodeLocations}>
                Find coordinates on map
              </button>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={useManualCoords}
                  onChange={(e) => setUseManualCoords(e.target.checked)}
                />
                Manual coordinate entry
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={livePricingEnabled}
                  onChange={(e) => setLivePricingEnabled(e.target.checked)}
                />
                Live surge pricing
              </label>
            </div>
            <label>
              Pickup Lat
              <input
                type="number"
                step="any"
                value={riderForm.pickupLat}
                readOnly={!useManualCoords}
                onChange={(e) =>
                  setRiderForm({ ...riderForm, pickupLat: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Pickup Lng
              <input
                type="number"
                step="any"
                value={riderForm.pickupLng}
                readOnly={!useManualCoords}
                onChange={(e) =>
                  setRiderForm({ ...riderForm, pickupLng: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Drop Lat
              <input
                type="number"
                step="any"
                value={riderForm.dropLat}
                readOnly={!useManualCoords}
                onChange={(e) =>
                  setRiderForm({ ...riderForm, dropLat: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Drop Lng
              <input
                type="number"
                step="any"
                value={riderForm.dropLng}
                readOnly={!useManualCoords}
                onChange={(e) =>
                  setRiderForm({ ...riderForm, dropLng: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Rider ID
              <input
                value={riderForm.riderId}
                onChange={(e) => setRiderForm({ ...riderForm, riderId: e.target.value })}
              />
            </label>
            <div className="full">
              <button type="submit" className="primary">
                Book Ride
              </button>
            </div>
          </form>

          {riderError && <p className="error">{riderError}</p>}
          {riderGeoStatus && <p className="status">{riderGeoStatus}</p>}
          {riderGeoError && <p className="error">{riderGeoError}</p>}
          {riderRouteError && <p className="error">{riderRouteError}</p>}
          {riderStreamStatus && <p className="status">{riderStreamStatus}</p>}
          {riderStreamError && <p className="error">{riderStreamError}</p>}

          <div className="map-panel">
            <h3>Live Route Map</h3>
            <div className="map-frame">
              <MapContainer
                center={riderMapCenter}
                zoom={13}
                className="map"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {riderMapBounds && <FitBounds bounds={riderMapBounds} />}
                {isValidLatLng(riderForm.pickupLat, riderForm.pickupLng) && (
                  <Marker
                    position={[riderForm.pickupLat, riderForm.pickupLng]}
                    icon={defaultMarkerIcon}
                  >
                    <Popup>Pickup: {riderForm.pickupName}</Popup>
                  </Marker>
                )}
                {isValidLatLng(riderForm.dropLat, riderForm.dropLng) && (
                  <Marker
                    position={[riderForm.dropLat, riderForm.dropLng]}
                    icon={defaultMarkerIcon}
                  >
                    <Popup>Drop: {riderForm.dropName}</Popup>
                  </Marker>
                )}
                {riderRoute?.coordinates?.length && (
                  <Polyline positions={riderRoute.coordinates} color="#38bdf8" weight={4} />
                )}
              </MapContainer>
            </div>
            {riderRoute && (
              <p className="meta">
                Route distance {formatNumber(riderRoute.distanceKm)} km · ETA{" "}
                {formatNumber(riderRoute.durationMin)} min
              </p>
            )}
          </div>

          {riderResult && (
            <div className="result">
              <h3>Pricing Result</h3>
              <div className="result-grid">
                <div>
                  <span>Distance</span>
                  <strong>{formatNumber(riderResult.distanceKm)} km</strong>
                </div>
                <div>
                  <span>Base Price</span>
                  <strong>{formatNumber(riderResult.basePrice)} Rs</strong>
                </div>
                <div>
                  <span>Surge Multiplier</span>
                  <strong>{formatNumber(riderResult.surgeMultiplier)}x</strong>
                </div>
                <div>
                  <span>Final Price</span>
                  <strong>{formatNumber(riderResult.finalPrice)} Rs</strong>
                </div>
                <div>
                  <span>Nearby Drivers</span>
                  <strong>{riderResult.nearbyDrivers}</strong>
                </div>
                <div>
                  <span>Demand / Driver Ratio</span>
                  <strong>{formatNumber(riderResult.ratio)}</strong>
                </div>
              </div>
              <div className="map-block">
                <p>
                  Route: {riderForm.pickupName} → {riderForm.dropName}
                </p>
                <a href={mapLink} target="_blank" rel="noreferrer">
                  Open map with route
                </a>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "driver" && (
        <section className="card">
          <h2>Driver Dashboard</h2>
          <div className="grid">
            <label>
              Driver ID
              <input
                value={driverForm.driverId}
                onChange={(e) => setDriverForm({ ...driverForm, driverId: e.target.value })}
              />
            </label>
            <label>
              Longitude
              <input
                type="number"
                step="any"
                value={driverForm.lng}
                onChange={(e) => setDriverForm({ ...driverForm, lng: Number(e.target.value) })}
              />
            </label>
            <label>
              Latitude
              <input
                type="number"
                step="any"
                value={driverForm.lat}
                onChange={(e) => setDriverForm({ ...driverForm, lat: Number(e.target.value) })}
              />
            </label>
            <div className="full">
              <button className="primary" onClick={handleDriverUpdate}>
                Submit Driver Location
              </button>
            </div>
          </div>

          <div className="divider" />

          <h3>Batch Driver Upload (JSON)</h3>
          <textarea
            value={driverBatch}
            onChange={(e) => setDriverBatch(e.target.value)}
            rows={8}
          />
          <button className="secondary" onClick={handleBatchUpload}>
            Send Batch
          </button>
          {driverStatus && <p className="status">{driverStatus}</p>}

          <div className="divider" />

          <h3>Check Nearby Riders</h3>
          <form className="grid" onSubmit={handleAvailability}>
            <label>
              Latitude
              <input
                type="number"
                step="any"
                value={availabilityForm.lat}
                onChange={(e) =>
                  setAvailabilityForm({ ...availabilityForm, lat: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Longitude
              <input
                type="number"
                step="any"
                value={availabilityForm.lng}
                onChange={(e) =>
                  setAvailabilityForm({ ...availabilityForm, lng: Number(e.target.value) })
                }
              />
            </label>
            <div className="full">
              <button className="primary" type="submit">
                Check Availability
              </button>
            </div>
          </form>

          {availabilityError && <p className="error">{availabilityError}</p>}

          {availabilityResult && (
            <div className="result">
              <p>
                Geofence: <strong>{availabilityResult.geofenceId}</strong>
              </p>
              <p>
                Nearby Drivers: <strong>{availabilityResult.nearbyDrivers}</strong>
              </p>
              <h4>Active Ride Requests</h4>
              {availabilityResult.activeRequests?.length ? (
                <div className="ride-list">
                  {availabilityResult.activeRequests.map((ride) => (
                    <div className="ride-card" key={ride.riderId + ride.createdAt}>
                      <div>
                        <strong>{ride.riderId}</strong>
                        <p>
                          {ride.pickupName || "Pickup"} → {ride.dropName || "Drop"}
                        </p>
                        <p>Distance: {formatNumber(ride.distanceKm)} km</p>
                        <p>Final Price: {formatNumber(ride.finalPrice)} Rs</p>
                        <button
                          className="secondary"
                          type="button"
                          onClick={() => setSelectedRide(ride)}
                        >
                          Show Route
                        </button>
                      </div>
                      <a
                        href={buildMapLink(ride.pickupLat, ride.pickupLng, ride.dropLat, ride.dropLng)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open map
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No active riders in this geofence.</p>
              )}
            </div>
          )}

          <div className="map-panel">
            <h3>Pickup & Drop Route</h3>
            {driverRouteError && <p className="error">{driverRouteError}</p>}
            {!selectedRide && <p className="status">Select a ride to preview the route.</p>}
            <div className="map-frame">
              <MapContainer
                center={driverMapCenter}
                zoom={13}
                className="map"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {driverMapBounds && <FitBounds bounds={driverMapBounds} />}
                {isValidLatLng(driverForm.lat, driverForm.lng) && (
                  <Marker position={[driverForm.lat, driverForm.lng]} icon={defaultMarkerIcon}>
                    <Popup>Driver current location</Popup>
                  </Marker>
                )}
                {selectedRide && isValidLatLng(selectedRide.pickupLat, selectedRide.pickupLng) && (
                  <Marker
                    position={[selectedRide.pickupLat, selectedRide.pickupLng]}
                    icon={defaultMarkerIcon}
                  >
                    <Popup>Pickup: {selectedRide.pickupName || "Pickup"}</Popup>
                  </Marker>
                )}
                {selectedRide && isValidLatLng(selectedRide.dropLat, selectedRide.dropLng) && (
                  <Marker
                    position={[selectedRide.dropLat, selectedRide.dropLng]}
                    icon={defaultMarkerIcon}
                  >
                    <Popup>Drop: {selectedRide.dropName || "Drop"}</Popup>
                  </Marker>
                )}
                {driverRoute?.coordinates?.length && (
                  <Polyline positions={driverRoute.coordinates} color="#22c55e" weight={4} />
                )}
              </MapContainer>
            </div>
            {selectedRide && (
              <div className="map-meta">
                <p>
                  Ride cost: <strong>{formatNumber(selectedRide.finalPrice)} Rs</strong>
                </p>
                {driverRoute && (
                  <p>
                    Total distance {formatNumber(driverRoute.distanceKm)} km · ETA{" "}
                    {formatNumber(driverRoute.durationMin)} min
                  </p>
                )}
                {isValidLatLng(driverForm.lat, driverForm.lng) &&
                  isValidLatLng(selectedRide.pickupLat, selectedRide.pickupLng) &&
                  isValidLatLng(selectedRide.dropLat, selectedRide.dropLng) && (
                    <a
                      href={buildDriverMapLink(
                        driverForm.lat,
                        driverForm.lng,
                        selectedRide.pickupLat,
                        selectedRide.pickupLng,
                        selectedRide.dropLat,
                        selectedRide.dropLng
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open full directions
                    </a>
                  )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}