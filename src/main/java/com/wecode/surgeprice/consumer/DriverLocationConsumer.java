package com.wecode.surgeprice.consumer;


import com.fasterxml.jackson.databind.ObjectMapper;
import com.wecode.surgeprice.config.SurgePricingProperties;
import com.wecode.surgeprice.dto.DriverLocationDTO;
import com.wecode.surgeprice.service.GeofenceService;
import com.wecode.surgeprice.service.RedisService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class DriverLocationConsumer {

    private static final Logger logger = LoggerFactory.getLogger(DriverLocationConsumer.class);

    private final ObjectMapper objectMapper;
    private final GeofenceService geofenceService;
    private final RedisService redisService;
    private final SurgePricingProperties properties;
    private final AtomicLong processedCount = new AtomicLong(0);

    public DriverLocationConsumer(ObjectMapper objectMapper,
                                  GeofenceService geofenceService,
                                  RedisService redisService,
                                  SurgePricingProperties properties) {
        this.objectMapper = objectMapper;
        this.geofenceService = geofenceService;
        this.redisService = redisService;
        this.properties = properties;
    }

    @KafkaListener(topics = "driver-locations", containerFactory = "kafkaListenerContainerFactory")
    public void consumeLocations(List<String> messages) {
        long startTime = System.currentTimeMillis();
        int successCount = 0;

        for (String message : messages) {
            try {
                DriverLocationDTO location = objectMapper.readValue(message, DriverLocationDTO.class);

                // Update all supported resolutions to allow dynamic pricing
                int minRes = properties.getMinH3Resolution();
                int maxRes = properties.getMaxH3Resolution();
                if (minRes > maxRes) {
                    minRes = properties.getH3Resolution();
                    maxRes = properties.getH3Resolution();
                }
                for (int res = minRes; res <= maxRes; res++) {
                    String geofenceId = geofenceService.getGeofenceId(location.getLat(), location.getLng(), res);
                    redisService.addDriver(res, geofenceId, location.getDriverId());
                }

                successCount++;

            } catch (Exception e) {
                logger.error("Failed to process location message: {}", message, e);
            }
        }

        long elapsed = System.currentTimeMillis() - startTime;
        long total = processedCount.addAndGet(successCount);

        if (total % 10000 == 0) {
            logger.info("Processed batch: {} messages in {}ms, total processed: {}",
                    successCount, elapsed, total);
        }
    }

    public long getProcessedCount() {
        return processedCount.get();
    }
}