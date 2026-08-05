import type { Libraries } from "@react-google-maps/api";

/** Shared loader id — must stay identical across every useJsApiLoader call. */
export const GOOGLE_MAPS_SCRIPT_ID = "google-map-script";

/** Prefer weekly channel so Places Autocomplete (New) APIs are available. */
export const GOOGLE_MAPS_API_VERSION = "weekly";

/**
 * Libraries loaded once for the whole app.
 * `marker` is required for AdvancedMarkerElement (legacy Marker is deprecated).
 */
export const GOOGLE_MAPS_LIBRARIES: Libraries = ["places", "marker"];

/** Cloud map ID required by AdvancedMarkerElement. Override via env when you have a real Map ID. */
export function getGoogleMapsMapId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() || "DEMO_MAP_ID";
}

export const GOOGLE_MAPS_DEFAULT_OPTIONS: google.maps.MapOptions = {
  mapId: getGoogleMapsMapId(),
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
};
