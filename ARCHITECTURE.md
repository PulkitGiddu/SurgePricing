# Surge Pricing Engine - Architecture & Data Flow

## Overview
This system ingests driver locations in real time, groups them into H3 geofences,
and computes ride pricing using demand vs driver ratio. Rider booking requests
and driver availability are tracked in Redis with a 30s freshness window.

## High-Level Architecture
1. **Driver Location Ingestion**
   - Frontend/clients send driver coordinates to `POST /driver/location`
   - The service publishes each update to **Kafka** topic `driver-locations`
   - `DriverLocationConsumer` consumes the topic and stores driver presence in Redis

2. **Rider Booking**
   - Rider submits pickup/drop locations to `POST /rider/book`
   - Backend computes:
     - distance (Haversine)
     - base price = `distanceKm * pricePerKm`
     - surge multiplier from **request / driver ratio**
   - A ride request record is saved to Redis (for drivers to see)

3. **Driver Availability**
   - Driver calls `GET /driver/availability?lat=...&lng=...`
   - Backend returns:
     - nearby driver count for that geofence
     - active ride requests in that geofence

4. **Price Lookup (legacy endpoint)**
   - `GET /price?lat=...&lng=...` uses the existing surge worker/Redis value
   - The new rider flow uses ratio-based surge directly

## Data Flow Diagram (Text)
```
Driver App -> POST /driver/location -> Kafka topic "driver-locations"
   -> DriverLocationConsumer -> Redis ZSET geofence:<res>:<id>:drivers (multiple res)

Rider App -> POST /rider/book
   -> H3 geofence + distance + ratio surge
   -> Redis ZSET geofence:<id>:requests (ride request record)
   -> response with price + nearby drivers

Driver App -> GET /driver/availability
   -> Redis read (drivers + requests)
   -> response with nearby drivers + ride list
```

## Pricing Logic (Rider Booking)
Inputs:
- `distanceKm` from pickup to drop
- `pricePerKm` (default 20)
- `requestCount` in geofence (including this booking)
- `driverCount` in geofence (active in last 30s)

Rules:
- `basePrice = distanceKm * pricePerKm`
- If `driverCount == 0` → `surge = 3.0`
- If `ratio <= 1.0` → `surge = 1.0`
- Else `surge = min(1 + ratio/2, 3.0)`
- `finalPrice = basePrice * surge`

## Redis Keys & Storage
Redis stores time-based presence using **ZSET** with timestamps as scores.

### Driver Presence
- Key: `geofence:<res>:<id>:drivers`
- Type: ZSET (member = driverId, score = timestamp ms)
- Freshness: 30s window (keys are pruned by score on each update)

### Ride Requests
- Key: `geofence:<res>:<id>:requests`
- Type: ZSET (member = JSON string of RideRequestRecordDTO)
- Freshness: 30s window

### Other Existing Keys (legacy surge worker)
- `geofence:<res>:<id>:surge` (String)
- `geofence:<res>:<id>:baseline` (String)
- `geofence:<res>:<id>:demand` (String)
- `geofence:<res>:<id>:last_update` (String)

## APIs
### Driver
- `POST /driver/location`
- `POST /driver/location/batch`
- `GET /driver/availability?lat=...&lng=...`

### Rider
- `POST /rider/book`

### Pricing (legacy)
- `GET /price?lat=...&lng=...`

## Frontend (React)
Two tabs:
1. Rider View
   - Inputs pickup/drop names + coordinates
   - Shows distance, base price, surge, final price, nearby drivers
   - Map link via OpenStreetMap
2. Driver View
   - Single driver update
   - Batch driver JSON upload
   - Availability check (shows active rides in same geofence)

## Configuration
`application.yml`
- `surge.price-per-km` = 20.0
- `surge.data-freshness-seconds` = 30
- `surge.max-surge-multiplier` = 3.0

