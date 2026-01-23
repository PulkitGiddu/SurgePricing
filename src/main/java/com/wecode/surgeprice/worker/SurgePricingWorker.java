package com.wecode.surgeprice.worker;


import com.wecode.surgeprice.config.SurgePricingProperties;
import com.wecode.surgeprice.service.RedisService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SurgePricingWorker {

    private static final Logger logger = LoggerFactory.getLogger(SurgePricingWorker.class);

    private final RedisService redisService;
    private final SurgePricingProperties properties;
    private final Map<String, Double> baselineHistory = new ConcurrentHashMap<>();
    private final Map<String, Double> previousSurge = new ConcurrentHashMap<>();
    private final Instant startTime = Instant.now();

    public SurgePricingWorker(RedisService redisService, SurgePricingProperties properties) {
        this.redisService = redisService;
        this.properties = properties;
    }

    @Scheduled(fixedDelayString = "15000", initialDelay = 5000) // Run every 15 seconds
    public void calculateSurge() {
        long start = System.currentTimeMillis();

        // Check if system is warmed up
        long uptimeSeconds = Instant.now().getEpochSecond() - startTime.getEpochSecond();
        if (uptimeSeconds < properties.getWarmupSeconds()) {
            logger.info("System warming up... {}s elapsed", uptimeSeconds);
            return;
        }

        try {
            Set<String> geofences = redisService.getActiveGeofences();
            int processed = 0;

            for (String key : geofences) {
                ParsedGeofence parsed = parseGeofenceKey(key);
                if (parsed == null) {
                    continue;
                }

                long currentDrivers = redisService.getDriverCount(parsed.resolution, parsed.geofenceId);
                long demand = redisService.getDemandCount(parsed.resolution, parsed.geofenceId);

                String cacheKey = cacheKey(parsed.resolution, parsed.geofenceId);

                // Update baseline (rolling average)
                double baseline = updateBaseline(cacheKey, currentDrivers);

                // Calculate surge
                double surge = calculateSurgeMultiplier(
                        cacheKey,
                        parsed.resolution,
                        parsed.geofenceId,
                        currentDrivers,
                        baseline,
                        demand
                );

                // Apply smoothing to prevent oscillations
                surge = applySurgeSmoothing(cacheKey, surge);

                // Store in Redis
                redisService.updateSurge(parsed.resolution, parsed.geofenceId, surge);
                redisService.updateBaseline(parsed.resolution, parsed.geofenceId, baseline);

                previousSurge.put(cacheKey, surge);
                processed++;
            }

            long elapsed = System.currentTimeMillis() - start;
            logger.info("Surge calculation completed: {} geofences processed in {}ms", processed, elapsed);

        } catch (Exception e) {
            logger.error("Error during surge calculation", e);
        }
    }

    private double updateBaseline(String cacheKey, long currentDrivers) {
        // Simple exponential moving average for baseline
        double alpha = 0.1; // Weight for new value
        double currentBaseline = baselineHistory.getOrDefault(cacheKey, (double) currentDrivers);
        double newBaseline = (alpha * currentDrivers) + ((1 - alpha) * currentBaseline);
        baselineHistory.put(cacheKey, newBaseline);
        return newBaseline;
    }

    private double calculateSurgeMultiplier(String cacheKey,
                                            int resolution,
                                            String geofenceId,
                                            long currentDrivers,
                                            double baseline,
                                            long demand) {
        // Don't apply surge if below minimum drivers
        if (currentDrivers < properties.getMinDrivers()) {
            return properties.getBaseSurgeMultiplier();
        }

        // Check for degraded mode (no recent updates)
        long lastUpdate = redisService.getLastUpdate(resolution, geofenceId);
        long timeSinceUpdate = System.currentTimeMillis() - lastUpdate;
        if (timeSinceUpdate > 5000) { // 5 seconds threshold
            logger.warn("Degraded mode for geofence {}: {}ms since last update",
                    geofenceId, timeSinceUpdate);
            // Return last known surge or base
            return previousSurge.getOrDefault(cacheKey, properties.getBaseSurgeMultiplier());
        }

        // Calculate driver availability ratio
        double ratio = baseline > 0 ? (double) currentDrivers / baseline : 1.0;

        // If drivers dropped by 50% or more, apply surge
        if (ratio <= (1.0 - properties.getSurgeDropThreshold())) {
            // Linear surge increase based on how much drivers dropped
            double surgeIncrease = (1.0 - ratio) * 2.0; // 50% drop = 1.0x increase
            double surge = properties.getBaseSurgeMultiplier() + surgeIncrease;

            if (demand > currentDrivers * 2) {
                surge += 0.5;
            }

            return Math.min(surge, properties.getMaxSurgeMultiplier());
        }

        return properties.getBaseSurgeMultiplier();
    }

    private double applySurgeSmoothing(String cacheKey, double newSurge) {
        Double previousSurgeValue = previousSurge.get(cacheKey);
        if (previousSurgeValue == null) {
            return newSurge;
        }

        // Limit surge jump to maxSurgeJump
        double diff = newSurge - previousSurgeValue;
        if (Math.abs(diff) > properties.getMaxSurgeJump()) {
            return previousSurgeValue + (Math.signum(diff) * properties.getMaxSurgeJump());
        }

        return newSurge;
    }

    private ParsedGeofence parseGeofenceKey(String key) {
        // Expected key: geofence:<resolution>:<geofenceId>:drivers
        String[] parts = key.split(":");
        if (parts.length < 4) {
            return null;
        }
        try {
            int resolution = Integer.parseInt(parts[1]);
            return new ParsedGeofence(resolution, parts[2]);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private String cacheKey(int resolution, String geofenceId) {
        return resolution + ":" + geofenceId;
    }

    private static class ParsedGeofence {
        private final int resolution;
        private final String geofenceId;

        private ParsedGeofence(int resolution, String geofenceId) {
            this.resolution = resolution;
            this.geofenceId = geofenceId;
        }
    }
}