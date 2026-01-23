# Surge Pricing Engine (H3 + Kafka + Redis)

## Why this system
Ride marketplaces fail when demand spikes: users churn if pricing is slow or unfair,
drivers churn if they cannot get rides. This system keeps the marketplace balanced
by reacting to supply/demand changes within a 30s freshness window.

**Real-world impact**
- **Fast pricing**: <100ms responses even under high reads.
- **Fairness**: dynamic H3 resolution avoids overpricing short rides and
  underpricing long rides.
- **Transparency**: users see nearby drivers, improving trust and conversion.

## How it works (high level)
1. **Driver updates** go to Kafka (`driver-locations`).
2. Consumer writes **driver presence** into Redis (ZSET with timestamps).
3. **Rider booking** computes distance, selects H3 resolution, and calculates
   surge from request/driver ratio.
4. **Driver availability** returns nearby drivers + active ride requests.

See `ARCHITECTURE.md` for full details.

## Dynamic H3 Resolution (MVP Optimization)
Resolution changes based on trip distance:
- **Short trip** → finer grid (higher resolution)
- **Long trip** → broader grid (lower resolution)
- **Mid trip** → default resolution

Default thresholds (configurable in `application.yml`):
- `short-trip-km-threshold: 5.0`
- `long-trip-km-threshold: 20.0`
- `min-h3-resolution: 7`
- `max-h3-resolution: 9`

This reduces unfair pricing when a short trip lands inside a large geofence.

## Pricing Logic (Rider Booking)
```
basePrice = distanceKm * pricePerKm
ratio = requestCount / driverCount

if driverCount == 0: surge = 3.0
elif ratio <= 1.0:   surge = 1.0
else:               surge = min(1 + ratio/2, 3.0)

finalPrice = basePrice * surge
```

## Run
### Backend
```
./mvnw spring-boot:run
```

### Frontend
```
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173`.

## Live Monitoring Commands (Terminal)
### 1) See price changes (booking flow)
```
while true; do
  curl -s -X POST http://localhost:8081/rider/book \
    -H "Content-Type: application/json" \
    -d '{"riderId":"rider_live","pickupLat":29.3446,"pickupLng":79.5644,"dropLat":29.3806,"dropLng":79.4636}' \
    | python - <<'PY'
import json,sys
data=json.load(sys.stdin)
print("surge:", data["surgeMultiplier"], "final:", data["finalPrice"],
      "drivers:", data["nearbyDrivers"], "ratio:", round(data["ratio"],2),
      "res:", data["resolution"], "geofence:", data["geofenceId"])
PY
  sleep 2
done
```

### 2) Watch driver count in Redis
```
redis-cli --scan --pattern "geofence:*:*:drivers"

redis-cli ZCARD "geofence:<RESOLUTION>:<GEOFENCE_ID>:drivers"
```

### 3) Watch ride requests in Redis
```
redis-cli ZCARD "geofence:<RESOLUTION>:<GEOFENCE_ID>:requests"
redis-cli ZRANGE "geofence:<RESOLUTION>:<GEOFENCE_ID>:requests" 0 -1
```

## API Endpoints
- `POST /driver/location`
- `POST /driver/location/batch`
- `GET /driver/availability?lat=...&lng=...`
- `POST /rider/book`

## Roadmap (Planned)
1. **Realtime surge updates (WebSockets/SSE)**
   - Push price changes to the rider UI without rebooking.
2. **Horizontal scale**
   - Multiple app nodes behind Nginx / load balancer.
3. **Distributed Redis**
   - Regional Redis clusters to reduce latency + cost.
