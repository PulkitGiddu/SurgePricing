package com.wecode.surgeprice.controller;


import com.fasterxml.jackson.databind.ObjectMapper;
import com.wecode.surgeprice.dto.DriverLocationDTO;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/driver")
public class DriverLocationController {

    private static final Logger logger = LoggerFactory.getLogger(DriverLocationController.class);
    private static final String TOPIC_NAME = "driver-locations";

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public DriverLocationController(KafkaTemplate<String, String> kafkaTemplate, ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/location")
    public ResponseEntity<Map<String, String>> updateLocation(@Valid @RequestBody DriverLocationDTO location) {
        try {
            // Convert to JSON of driver and send to Kafka asynchronously
            String message = objectMapper.writeValueAsString(location);

            kafkaTemplate.send(TOPIC_NAME, location.getDriverId(), message)
                    .whenComplete((result, ex) -> {
                        if (ex != null) {
                            logger.error("Failed to send location update for driver {}", location.getDriverId(), ex);
                        }
                    });

            return ResponseEntity.status(HttpStatus.ACCEPTED)
                    .body(Map.of("status", "accepted", "driverId", location.getDriverId()));

        } catch (Exception e) {
            logger.error("Error processing location update", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    @PostMapping("/location/batch")
    public ResponseEntity<Map<String, String>> updateLocationBatch(
            @Valid @RequestBody List<DriverLocationDTO> locations) {
        int accepted = 0;
        for (DriverLocationDTO location : locations) {
            try {
                String message = objectMapper.writeValueAsString(location);
                kafkaTemplate.send(TOPIC_NAME, location.getDriverId(), message)
                        .whenComplete((result, ex) -> {
                            if (ex != null) {
                                logger.error("Failed to send location update for driver {}", location.getDriverId(), ex);
                            }
                        });
                accepted++;
            } catch (Exception e) {
                logger.error("Error processing location update", e);
            }
        }
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(Map.of("status", "accepted", "count", String.valueOf(accepted)));
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "healthy", "service", "driver-location"));
    }
}