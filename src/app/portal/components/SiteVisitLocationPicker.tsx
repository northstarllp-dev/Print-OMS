"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { GoogleMap } from "@react-google-maps/api";
import { Loader2 } from "lucide-react";
import { AdvancedMapMarker } from "@/components/maps/AdvancedMapMarker";
import { PlaceAutocompleteInput } from "@/components/maps/PlaceAutocompleteInput";
import { GOOGLE_MAPS_DEFAULT_OPTIONS } from "@/components/maps/googleMapsConfig";
import { isGoogleMapsUrl } from "@/components/maps/mapsUrl";
import { resolveGoogleMapsLocation } from "@/components/maps/resolveGoogleMapsLocation";
import { PortalMapsLoader } from "./PortalMapsLoader";

const containerStyle = { width: "100%", height: "100%" };

interface SiteVisitLocationPickerProps {
  siteAddress: string;
  onAddressChange: (address: string) => void;
  gpsCoords: string;
  onLocationChange: (lat: number, lng: number, address?: string) => void;
  markerPosition: { lat: number; lng: number };
  mapCenter: { lat: number; lng: number };
}

/**
 * Maps + address search isolated so Google Maps never loads for other portal tabs.
 */
export function SiteVisitLocationPicker({
  siteAddress,
  onAddressChange,
  gpsCoords,
  onLocationChange,
  markerPosition,
  mapCenter,
}: SiteVisitLocationPickerProps) {
  return (
    <PortalMapsLoader>
      {({ isLoaded }) => (
        <SiteVisitLocationPickerInner
          isLoaded={isLoaded}
          siteAddress={siteAddress}
          onAddressChange={onAddressChange}
          gpsCoords={gpsCoords}
          onLocationChange={onLocationChange}
          markerPosition={markerPosition}
          mapCenter={mapCenter}
        />
      )}
    </PortalMapsLoader>
  );
}

function SiteVisitLocationPickerInner({
  isLoaded,
  siteAddress,
  onAddressChange,
  gpsCoords,
  onLocationChange,
  markerPosition,
  mapCenter,
}: SiteVisitLocationPickerProps & { isLoaded: boolean }) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [mapsSearching, setMapsSearching] = useState(false);
  const geocoder = useRef<google.maps.Geocoder | null>(null);

  useEffect(() => {
    if (isLoaded && !geocoder.current) {
      geocoder.current = new window.google.maps.Geocoder();
    }
  }, [isLoaded]);

  const reverseGeocode = useCallback((lat: number, lng: number) => {
    if (!geocoder.current) return;
    geocoder.current.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === "OK" && results?.[0]) {
        onAddressChange(results[0].formatted_address);
      }
    });
  }, [onAddressChange]);

  const onMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      onLocationChange(lat, lng);
      reverseGeocode(lat, lng);
    },
    [onLocationChange, reverseGeocode]
  );

  const tryResolveMapsLink = useCallback(
    async (value: string) => {
      if (!isGoogleMapsUrl(value)) return;
      setMapsSearching(true);
      try {
        const resolved = await resolveGoogleMapsLocation(value);
        if (!resolved) {
          alert(
            "Could not open that Google Maps link. Paste a full Maps URL or search for the address."
          );
          return;
        }
        onLocationChange(resolved.lat, resolved.lng, resolved.address);
      } catch (err) {
        console.error("[Portal] Maps link resolve failed:", err);
        alert("Could not open that Google Maps link. Please try again.");
      } finally {
        setMapsSearching(false);
      }
    },
    [onLocationChange]
  );

  const handleCurrentLocation = () => {
    setMapsSearching(true);
    if (!("geolocation" in navigator)) {
      alert("Geolocation is not supported by your browser.");
      setMapsSearching(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        onLocationChange(lat, lng);
        reverseGeocode(lat, lng);
        setMapsSearching(false);
      },
      () => {
        alert("Could not detect your location. Please check your browser permissions.");
        setMapsSearching(false);
      }
    );
  };

  return (
    <>
      {isLoaded ? (
        <PlaceAutocompleteInput
          isLoaded={isLoaded}
          required
          value={siteAddress}
          onChange={onAddressChange}
          onPlaceSelect={({ address, lat, lng }) =>
            onLocationChange(lat, lng, address)
          }
          onMapsUrl={(url) => void tryResolveMapsLink(url)}
          placeholder="Search address or paste a Google Maps link..."
          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none bg-gray-50 focus:bg-white transition-all"
        />
      ) : (
        <input
          type="text"
          required
          value={siteAddress}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="Full address where signage will be installed"
          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none bg-gray-50 focus:bg-white transition-all"
        />
      )}

      <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
        <div className="h-40 bg-[#e8edf2] relative">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={containerStyle}
              center={mapCenter}
              zoom={14}
              onClick={onMapClick}
              onLoad={setMap}
              onUnmount={() => setMap(null)}
              options={GOOGLE_MAPS_DEFAULT_OPTIONS}
            >
              <AdvancedMapMarker map={map} position={markerPosition} />
            </GoogleMap>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
              Loading Map...
            </div>
          )}
        </div>
        <div className="px-3 py-2 bg-white border-t border-gray-200 flex items-center justify-between">
          <span className="text-[10px] font-mono font-semibold text-gray-600">
            📍 {gpsCoords}
          </span>
          <button
            type="button"
            onClick={handleCurrentLocation}
            className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
          >
            {mapsSearching ? <Loader2 size={10} className="animate-spin" /> : null}
            {mapsSearching ? "Detecting..." : "Auto-detect"}
          </button>
        </div>
      </div>
    </>
  );
}
