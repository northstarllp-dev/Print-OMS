"use client";

import { useEffect, useRef } from "react";

type LatLng = { lat: number; lng: number };

type AdvancedMapMarkerProps = {
  map: google.maps.Map | null;
  position: LatLng;
  title?: string;
};

/**
 * Drop-in replacement for deprecated google.maps.Marker / <Marker />.
 * Requires the map to be created with a mapId (see googleMapsConfig).
 */
export function AdvancedMapMarker({ map, position, title }: AdvancedMapMarkerProps) {
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const positionRef = useRef(position);
  positionRef.current = position;

  useEffect(() => {
    if (!map) return;
    let cancelled = false;

    void (async () => {
      const { AdvancedMarkerElement } = (await google.maps.importLibrary(
        "marker"
      )) as google.maps.MarkerLibrary;
      if (cancelled) return;

      if (markerRef.current) {
        markerRef.current.map = null;
        markerRef.current = null;
      }

      markerRef.current = new AdvancedMarkerElement({
        map,
        position: positionRef.current,
        title,
      });
    })();

    return () => {
      cancelled = true;
      if (markerRef.current) {
        markerRef.current.map = null;
        markerRef.current = null;
      }
    };
  }, [map, title]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    marker.position = position;
  }, [position]);

  return null;
}
