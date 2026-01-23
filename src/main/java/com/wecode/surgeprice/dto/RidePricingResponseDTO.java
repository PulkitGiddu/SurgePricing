package com.wecode.surgeprice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class RidePricingResponseDTO {

    @JsonProperty("riderId")
    private String riderId;

    @JsonProperty("distanceKm")
    private double distanceKm;

    @JsonProperty("basePrice")
    private double basePrice;

    @JsonProperty("surgeMultiplier")
    private double surgeMultiplier;

    @JsonProperty("finalPrice")
    private double finalPrice;

    @JsonProperty("geofenceId")
    private String geofenceId;

    @JsonProperty("resolution")
    private int resolution;

    @JsonProperty("nearbyDrivers")
    private long nearbyDrivers;

    @JsonProperty("requestCount")
    private long requestCount;

    @JsonProperty("ratio")
    private double ratio;

    @JsonProperty("pickupName")
    private String pickupName;

    @JsonProperty("dropName")
    private String dropName;

    public RidePricingResponseDTO(String riderId,
                                  double distanceKm,
                                  double basePrice,
                                  double surgeMultiplier,
                                  double finalPrice,
                                  String geofenceId,
                                  int resolution,
                                  long nearbyDrivers,
                                  long requestCount,
                                  double ratio,
                                  String pickupName,
                                  String dropName) {
        this.riderId = riderId;
        this.distanceKm = distanceKm;
        this.basePrice = basePrice;
        this.surgeMultiplier = surgeMultiplier;
        this.finalPrice = finalPrice;
        this.geofenceId = geofenceId;
        this.resolution = resolution;
        this.nearbyDrivers = nearbyDrivers;
        this.requestCount = requestCount;
        this.ratio = ratio;
        this.pickupName = pickupName;
        this.dropName = dropName;
    }

    public String getRiderId() { return riderId; }
    public double getDistanceKm() { return distanceKm; }
    public double getBasePrice() { return basePrice; }
    public double getSurgeMultiplier() { return surgeMultiplier; }
    public double getFinalPrice() { return finalPrice; }
    public String getGeofenceId() { return geofenceId; }
    public int getResolution() { return resolution; }
    public long getNearbyDrivers() { return nearbyDrivers; }
    public long getRequestCount() { return requestCount; }
    public double getRatio() { return ratio; }
    public String getPickupName() { return pickupName; }
    public String getDropName() { return dropName; }
}
