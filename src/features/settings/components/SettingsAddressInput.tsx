"use client";

import React from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { PlaceAutocompleteInput } from "@/components/maps/PlaceAutocompleteInput";
import {
  GOOGLE_MAPS_API_VERSION,
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_SCRIPT_ID,
} from "@/components/maps/googleMapsConfig";

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
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: mapsApiKey || "no-key",
    libraries: GOOGLE_MAPS_LIBRARIES,
    version: GOOGLE_MAPS_API_VERSION,
  });

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
    <PlaceAutocompleteInput
      isLoaded={isLoaded}
      value={value}
      onChange={onChange}
      onPlaceSelect={({ address }) => onChange(address)}
      placeholder="Search address..."
      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] font-[inherit] bg-white outline-none focus:border-slate-400 focus:ring-[3px] focus:ring-slate-400/10"
      style={style}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
}
