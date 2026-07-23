"use client";

import React, { useState } from "react";
import { useJsApiLoader, Autocomplete } from "@react-google-maps/api";

const PLACES_LIBRARIES: ("places")[] = ["places"];

interface SettingsAddressInputProps {
  value: string;
  onChange: (value: string) => void;
  style?: React.CSSProperties;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

/** Isolated so Google Maps never loads during SSR of unrelated routes. */
export function SettingsAddressInput({
  value,
  onChange,
  style,
  onFocus,
  onBlur,
}: SettingsAddressInputProps) {
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: mapsApiKey || "no-key",
    libraries: PLACES_LIBRARIES,
  });
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  const input = (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={style}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );

  if (!mapsApiKey || !isLoaded || loadError) {
    return input;
  }

  return (
    <Autocomplete
      onLoad={(autoC) => setAutocomplete(autoC)}
      onPlaceChanged={() => {
        if (!autocomplete) return;
        const place = autocomplete.getPlace();
        if (place.formatted_address) onChange(place.formatted_address);
      }}
    >
      {input}
    </Autocomplete>
  );
}
