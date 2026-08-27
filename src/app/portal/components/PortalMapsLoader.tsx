"use client";

import React from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import {
  GOOGLE_MAPS_API_VERSION,
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_SCRIPT_ID,
} from "@/components/maps/googleMapsConfig";

/**
 * Loads the Google Maps JS SDK only while mounted.
 * Mount this solely on Site Visit scheduling UI not on every portal tab.
 */
export function PortalMapsLoader({
  children,
}: {
  children: (api: { isLoaded: boolean }) => React.ReactNode;
}) {
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: GOOGLE_MAPS_LIBRARIES,
    version: GOOGLE_MAPS_API_VERSION,
  });

  return <>{children({ isLoaded })}</>;
}
