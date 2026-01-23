package com.wecode.surgeprice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class RideRequestRecordDTO {

    @JsonProperty("riderId")
    private String riderId;

    @JsonProperty("pickupLat")
    private double pickupLat;

    @JsonProperty("pickupLng")
    private double pickupLng;

    @JsonProperty("dropLat")
    private double dropLat;

    @JsonProperty("dropLng")
    private double dropLng;

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

    @JsonProperty("pickupName")
    private String pickupName;

    @JsonProperty("dropName")
    private String dropName;

    @JsonProperty("createdAt")
    private long createdAt;

    public RideRequestRecordDTO() {
    }

    public RideRequestRecordDTO(String riderId,
                                double pickupLat,
                                double pickupLng,
                                double dropLat,
                                double dropLng,
                                double distanceKm,
                                double basePrice,
                                double surgeMultiplier,
                                double finalPrice,
                                String geofenceId,
                                int resolution,
                                String pickupName,
                                String dropName,
                                long createdAt) {
        this.riderId = riderId;
        this.pickupLat = pickupLat;
        this.pickupLng = pickupLng;
        this.dropLat = dropLat;
        this.dropLng = dropLng;
        this.distanceKm = distanceKm;
        this.basePrice = basePrice;
        this.surgeMultiplier = surgeMultiplier;
        this.finalPrice = finalPrice;
        this.geofenceId = geofenceId;
        this.resolution = resolution;
        this.pickupName = pickupName;
        this.dropName = dropName;
        this.createdAt = createdAt;
    }

    public String getRiderId() { return riderId; }
    public void setRiderId(String riderId) { this.riderId = riderId; }

    public double getPickupLat() { return pickupLat; }
    public void setPickupLat(double pickupLat) { this.pickupLat = pickupLat; }

    public double getPickupLng() { return pickupLng; }
    public void setPickupLng(double pickupLng) { this.pickupLng = pickupLng; }

    public double getDropLat() { return dropLat; }
    public void setDropLat(double dropLat) { this.dropLat = dropLat; }

    public double getDropLng() { return dropLng; }
    public void setDropLng(double dropLng) { this.dropLng = dropLng; }

    public double getDistanceKm() { return distanceKm; }
    public void setDistanceKm(double distanceKm) { this.distanceKm = distanceKm; }

    public double getBasePrice() { return basePrice; }
    public void setBasePrice(double basePrice) { this.basePrice = basePrice; }

    public double getSurgeMultiplier() { return surgeMultiplier; }
    public void setSurgeMultiplier(double surgeMultiplier) { this.surgeMultiplier = surgeMultiplier; }

    public double getFinalPrice() { return finalPrice; }
    public void setFinalPrice(double finalPrice) { this.finalPrice = finalPrice; }

    public String getGeofenceId() { return geofenceId; }
    public void setGeofenceId(String geofenceId) { this.geofenceId = geofenceId; }

    public int getResolution() { return resolution; }
    public void setResolution(int resolution) { this.resolution = resolution; }

    public String getPickupName() { return pickupName; }
    public void setPickupName(String pickupName) { this.pickupName = pickupName; }

    public String getDropName() { return dropName; }
    public void setDropName(String dropName) { this.dropName = dropName; }

    public long getCreatedAt() { return createdAt; }
    public void setCreatedAt(long createdAt) { this.createdAt = createdAt; }
}
