package com.wecode.surgeprice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wecode.surgeprice.dto.RidePricingResponseDTO;
import com.wecode.surgeprice.dto.RideRequestDTO;
import com.wecode.surgeprice.dto.RideRequestRecordDTO;
import com.wecode.surgeprice.service.GeofenceService;
import com.wecode.surgeprice.service.PricingService;
import com.wecode.surgeprice.service.RedisService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.concurrent.Executor;

@RestController
@RequestMapping("/rider")
public class RiderController {

    private static final Logger logger = LoggerFactory.getLogger(RiderController.class);

    private final PricingService pricingService;
    private final GeofenceService geofenceService;
    private final RedisService redisService;
    private final ObjectMapper objectMapper;
    private final Executor asyncExecutor;

    public RiderController(PricingService pricingService,
                           GeofenceService geofenceService,
                           RedisService redisService,
                           ObjectMapper objectMapper,
                           @Qualifier("asyncExecutor") Executor asyncExecutor) {
        this.pricingService = pricingService;
        this.geofenceService = geofenceService;
        this.redisService = redisService;
        this.objectMapper = objectMapper;
        this.asyncExecutor = asyncExecutor;
    }

    @PostMapping("/book")
    public ResponseEntity<RidePricingResponseDTO> bookRide(@Valid @RequestBody RideRequestDTO request) {
        double distanceKm = pricingService.calculateDistanceKm(
                request.getPickupLat(),
                request.getPickupLng(),
                request.getDropLat(),
                request.getDropLng()
        );
        int resolution = pricingService.selectResolution(distanceKm);
        String geofenceId = geofenceService.getGeofenceId(
                request.getPickupLat(),
                request.getPickupLng(),
                resolution
        );
        double basePrice = pricingService.calculateBasePrice(distanceKm);

        long nearbyDrivers = redisService.getDriverCount(resolution, geofenceId);
        long requestCount = redisService.getRideRequestCount(resolution, geofenceId) + 1;

        double surgeMultiplier = pricingService.calculateSurge(requestCount, nearbyDrivers);
        double ratio = nearbyDrivers > 0 ? (double) requestCount / (double) nearbyDrivers : requestCount;
        double finalPrice = basePrice * surgeMultiplier;

        RideRequestRecordDTO record = new RideRequestRecordDTO(
                request.getRiderId(),
                request.getPickupLat(),
                request.getPickupLng(),
                request.getDropLat(),
                request.getDropLng(),
                distanceKm,
                basePrice,
                surgeMultiplier,
                finalPrice,
                geofenceId,
                resolution,
                request.getPickupName(),
                request.getDropName(),
                System.currentTimeMillis()
        );

        try {
            String payload = objectMapper.writeValueAsString(record);
            redisService.addRideRequest(resolution, geofenceId, payload);
        } catch (Exception e) {
            logger.error("Failed to store ride request", e);
        }

        RidePricingResponseDTO response = new RidePricingResponseDTO(
                request.getRiderId(),
                distanceKm,
                basePrice,
                surgeMultiplier,
                finalPrice,
                geofenceId,
                resolution,
                nearbyDrivers,
                requestCount,
                ratio,
                request.getPickupName(),
                request.getDropName()
        );

        return ResponseEntity.ok(response);
    }

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamPrice(@RequestParam("pickupLat") double pickupLat,
                                  @RequestParam("pickupLng") double pickupLng,
                                  @RequestParam("dropLat") double dropLat,
                                  @RequestParam("dropLng") double dropLng,
                                  @RequestParam(value = "riderId", defaultValue = "rider_live") String riderId,
                                  @RequestParam(value = "pickupName", required = false) String pickupName,
                                  @RequestParam(value = "dropName", required = false) String dropName) {
        double distanceKm = pricingService.calculateDistanceKm(pickupLat, pickupLng, dropLat, dropLng);
        int resolution = pricingService.selectResolution(distanceKm);
        String geofenceId = geofenceService.getGeofenceId(pickupLat, pickupLng, resolution);
        double basePrice = pricingService.calculateBasePrice(distanceKm);

        RideRequestRecordDTO record = new RideRequestRecordDTO(
                riderId,
                pickupLat,
                pickupLng,
                dropLat,
                dropLng,
                distanceKm,
                basePrice,
                1.0,
                basePrice,
                geofenceId,
                resolution,
                pickupName,
                dropName,
                System.currentTimeMillis()
        );

        try {
            String payload = objectMapper.writeValueAsString(record);
            redisService.addRideRequest(resolution, geofenceId, payload);
        } catch (Exception e) {
            logger.error("Failed to store ride request for stream", e);
        }

        SseEmitter emitter = new SseEmitter(0L);
        asyncExecutor.execute(() -> {
            try {
                while (true) {
                    long nearbyDrivers = redisService.getDriverCount(resolution, geofenceId);
                    long requestCount = redisService.getRideRequestCount(resolution, geofenceId);
                    double surgeMultiplier = pricingService.calculateSurge(requestCount, nearbyDrivers);
                    double ratio = nearbyDrivers > 0 ? (double) requestCount / (double) nearbyDrivers : requestCount;
                    double finalPrice = basePrice * surgeMultiplier;

                    RidePricingResponseDTO response = new RidePricingResponseDTO(
                            riderId,
                            distanceKm,
                            basePrice,
                            surgeMultiplier,
                            finalPrice,
                            geofenceId,
                            resolution,
                            nearbyDrivers,
                            requestCount,
                            ratio,
                            pickupName,
                            dropName
                    );

                    emitter.send(SseEmitter.event().name("price").data(response));
                    Thread.sleep(2000);
                }
            } catch (Exception e) {
                emitter.completeWithError(e);
            }
        });

        return emitter;
    }
}
