import { useMemo, useState } from "react";

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

function buildMapLink(pickupLat, pickupLng, dropLat, dropLng) {
  return `https:=${pickupLat},${pickupLng};${dropLat},${dropLng}`;
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : "-";
}

export default function App() {
  const [tab, setTab] = useState("rider");
  const [riderForm, setRiderForm] = useState(defaultRider);
  const [riderResult, setRiderResult] = useState(null);
  const [riderError, setRiderError] = useState("");

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

  const mapLink = useMemo(() => {
    if (!riderResult) return "";
    return buildMapLink(
      riderForm.pickupLat,
      riderForm.pickupLng,
      riderForm.dropLat,
      riderForm.dropLng
    );
  }, [riderForm, riderResult]);

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
            <label>
              Pickup Lat
              <input
                type="number"
                step="any"
                value={riderForm.pickupLat}
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
        </section>
      )}
    </div>
  );
}
