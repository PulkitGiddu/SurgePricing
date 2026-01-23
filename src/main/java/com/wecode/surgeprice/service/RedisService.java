package com.wecode.surgeprice.service;


import com.wecode.surgeprice.config.SurgePricingProperties;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Set;

@Service
public class RedisService {

    private static final String DRIVER_KEY_PREFIX = "geofence:%d:%s:drivers";
    private static final String REQUEST_KEY_PREFIX = "geofence:%d:%s:requests";
    private static final String DEMAND_KEY_PREFIX = "geofence:%d:%s:demand";
    private static final String BASELINE_KEY_PREFIX = "geofence:%d:%s:baseline";
    private static final String SURGE_KEY_PREFIX = "geofence:%d:%s:surge";
    private static final String LAST_UPDATE_KEY_PREFIX = "geofence:%d:%s:last_update";

    private final RedisTemplate<String, String> redisTemplate;
    private final SurgePricingProperties properties;

    public RedisService(RedisTemplate<String, String> redisTemplate, SurgePricingProperties properties) {
        this.redisTemplate = redisTemplate;
        this.properties = properties;
    }

    public void addDriver(int resolution, String geofenceId, String driverId) {
        String key = String.format(DRIVER_KEY_PREFIX, resolution, geofenceId);
        long now = System.currentTimeMillis();
        redisTemplate.opsForZSet().add(key, driverId, now);
        pruneOld(key, now);
        redisTemplate.expire(key, Duration.ofSeconds(properties.getDataFreshnessSeconds()));
        updateLastSeen(resolution, geofenceId);
    }

    public long getDriverCount(int resolution, String geofenceId) {
        String key = String.format(DRIVER_KEY_PREFIX, resolution, geofenceId);
        long now = System.currentTimeMillis();
        Long count = redisTemplate.opsForZSet()
                .count(key, now - properties.getDataFreshnessSeconds() * 1000L, now);
        return count != null ? count : 0;
    }

    public Set<String> getDrivers(int resolution, String geofenceId) {
        String key = String.format(DRIVER_KEY_PREFIX, resolution, geofenceId);
        long now = System.currentTimeMillis();
        return redisTemplate.opsForZSet()
                .rangeByScore(key, now - properties.getDataFreshnessSeconds() * 1000L, now);
    }

    public void addRideRequest(int resolution, String geofenceId, String requestJson) {
        String key = String.format(REQUEST_KEY_PREFIX, resolution, geofenceId);
        long now = System.currentTimeMillis();
        redisTemplate.opsForZSet().add(key, requestJson, now);
        pruneOld(key, now);
        redisTemplate.expire(key, Duration.ofSeconds(properties.getDataFreshnessSeconds()));
    }

    public long getRideRequestCount(int resolution, String geofenceId) {
        String key = String.format(REQUEST_KEY_PREFIX, resolution, geofenceId);
        long now = System.currentTimeMillis();
        Long count = redisTemplate.opsForZSet()
                .count(key, now - properties.getDataFreshnessSeconds() * 1000L, now);
        return count != null ? count : 0;
    }

    public List<String> getActiveRideRequests(int resolution, String geofenceId) {
        String key = String.format(REQUEST_KEY_PREFIX, resolution, geofenceId);
        long now = System.currentTimeMillis();
        Set<String> results = redisTemplate.opsForZSet()
                .rangeByScore(key, now - properties.getDataFreshnessSeconds() * 1000L, now);
        return results != null ? List.copyOf(results) : List.of();
    }

    public void incrementDemand(int resolution, String geofenceId) {
        String key = String.format(DEMAND_KEY_PREFIX, resolution, geofenceId);
        redisTemplate.opsForValue().increment(key);
        redisTemplate.expire(key, Duration.ofSeconds(properties.getDataFreshnessSeconds()));
    }

    public long getDemandCount(int resolution, String geofenceId) {
        String key = String.format(DEMAND_KEY_PREFIX, resolution, geofenceId);
        String value = redisTemplate.opsForValue().get(key);
        return value != null ? Long.parseLong(value) : 0;
    }

    public void updateBaseline(int resolution, String geofenceId, double baseline) {
        String key = String.format(BASELINE_KEY_PREFIX, resolution, geofenceId);
        redisTemplate.opsForValue().set(key, String.valueOf(baseline));
    }

    public double getBaseline(int resolution, String geofenceId) {
        String key = String.format(BASELINE_KEY_PREFIX, resolution, geofenceId);
        String value = redisTemplate.opsForValue().get(key);
        return value != null ? Double.parseDouble(value) : 0.0;
    }

    // Surge operations
    public void updateSurge(int resolution, String geofenceId, double surge) {
        String key = String.format(SURGE_KEY_PREFIX, resolution, geofenceId);
        redisTemplate.opsForValue().set(key, String.valueOf(surge));
    }

    public double getSurge(int resolution, String geofenceId) {
        String key = String.format(SURGE_KEY_PREFIX, resolution, geofenceId);
        String value = redisTemplate.opsForValue().get(key);
        return value != null ? Double.parseDouble(value) : properties.getBaseSurgeMultiplier();
    }

    private void updateLastSeen(int resolution, String geofenceId) {
        String key = String.format(LAST_UPDATE_KEY_PREFIX, resolution, geofenceId);
        redisTemplate.opsForValue().set(key, String.valueOf(System.currentTimeMillis()));
    }

    public long getLastUpdate(int resolution, String geofenceId) {
        String key = String.format(LAST_UPDATE_KEY_PREFIX, resolution, geofenceId);
        String value = redisTemplate.opsForValue().get(key);
        return value != null ? Long.parseLong(value) : 0;
    }

    public Set<String> getActiveGeofences() {
        Set<String> keys = redisTemplate.keys("geofence:*:*:drivers");
        return keys != null ? keys : Set.of();
    }

    private void pruneOld(String key, long now) {
        long cutoff = now - (properties.getDataFreshnessSeconds() * 1000L);
        redisTemplate.opsForZSet().removeRangeByScore(key, 0, cutoff);
    }
}