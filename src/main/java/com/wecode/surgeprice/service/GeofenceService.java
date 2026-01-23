package com.wecode.surgeprice.service;


import com.wecode.surgeprice.config.SurgePricingProperties;
import com.uber.h3core.H3Core;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class GeofenceService {

    private static final Logger logger = LoggerFactory.getLogger(GeofenceService.class);

    private final H3Core h3;
    private final SurgePricingProperties properties;

    public GeofenceService(H3Core h3, SurgePricingProperties properties) {
        this.h3 = h3;
        this.properties = properties;
    }

    public String getGeofenceId(double lat, double lng) {
        try {
            long h3Index = h3.latLngToCell(lat, lng, properties.getH3Resolution());
            return Long.toHexString(h3Index);
        } catch (Exception e) {
            logger.error("Error converting lat/lng to H3: lat={}, lng={}", lat, lng, e);
            return "default";
        }
    }

    public String getGeofenceId(double lat, double lng, int resolution) {
        try {
            long h3Index = h3.latLngToCell(lat, lng, resolution);
            return Long.toHexString(h3Index);
        } catch (Exception e) {
            logger.error("Error converting lat/lng to H3: lat={}, lng={}, res={}", lat, lng, resolution, e);
            return "default";
        }
    }
}