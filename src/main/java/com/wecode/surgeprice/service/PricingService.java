package com.wecode.surgeprice.service;


import com.wecode.surgeprice.config.SurgePricingProperties;
import com.wecode.surgeprice.dto.PriceResponseDTO;
import org.springframework.stereotype.Service;

@Service
public class PricingService {

    private final GeofenceService geofenceService;
    private final RedisService redisService;
    private final SurgePricingProperties properties;

    public PricingService(GeofenceService geofenceService,
                          RedisService redisService,
                          SurgePricingProperties properties) {
        this.geofenceService = geofenceService;
        this.redisService = redisService;
        this.properties = properties;
    }

    /**
     * O(1) price lookup - just Redis get operations
     */
    public PriceResponseDTO getPrice(double lat, double lng) {

        String geofenceId = geofenceService.getGeofenceId(lat, lng, properties.getH3Resolution());

        double surgeMultiplier = redisService.getSurge(properties.getH3Resolution(), geofenceId);


        return new PriceResponseDTO(
                properties.getBaseFare(),
                surgeMultiplier,
                geofenceId
        );
    }

    public double calculateDistanceKm(double lat1, double lng1, double lat2, double lng2) {
        double earthRadiusKm = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadiusKm * c;
    }

    public double calculateSurge(long requestCount, long driverCount) {
        if (driverCount <= 0) {
            return properties.getMaxSurgeMultiplier();
        }
        double ratio = (double) requestCount / (double) driverCount;
        if (ratio <= 1.0) {
            return 1.0;
        }
        return Math.min(1.0 + (ratio / 2.0), properties.getMaxSurgeMultiplier());
    }

    public double calculateBasePrice(double distanceKm) {
        return distanceKm * properties.getPricePerKm();
    }

    public int selectResolution(double distanceKm) {
        int minRes = properties.getMinH3Resolution();
        int maxRes = properties.getMaxH3Resolution();
        if (minRes > maxRes) {
            return properties.getH3Resolution();
        }
        if (distanceKm <= properties.getShortTripKmThreshold()) {
            return maxRes;
        }
        if (distanceKm >= properties.getLongTripKmThreshold()) {
            return minRes;
        }
        return properties.getH3Resolution();
    }
}