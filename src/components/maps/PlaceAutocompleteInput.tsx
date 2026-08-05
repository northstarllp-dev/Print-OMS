"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isGoogleMapsUrl } from "@/components/maps/mapsUrl";

export type PlaceSelection = {
  address: string;
  lat: number;
  lng: number;
};

type SuggestionRow = {
  id: string;
  label: string;
  prediction: google.maps.places.PlacePrediction;
};

const DEFAULT_REGION_CODES = ["in"];

interface PlaceAutocompleteInputProps {
  isLoaded: boolean;
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (place: PlaceSelection) => void;
  onMapsUrl?: (url: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  regionCodes?: string[];
}

/**
 * Places Autocomplete (New) via AutocompleteSuggestion data API + our own dropdown.
 * Avoids legacy Autocomplete (blocked for new keys) and PlaceAutocompleteElement
 * clipping inside overflow:hidden modals.
 */
export function PlaceAutocompleteInput({
  isLoaded,
  value,
  onChange,
  onPlaceSelect,
  onMapsUrl,
  placeholder = "Search address or paste a Google Maps link...",
  required,
  className =
    "w-full p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none bg-slate-50 focus:bg-white transition-all",
  style,
  onFocus,
  onBlur,
  regionCodes = DEFAULT_REGION_CODES,
}: PlaceAutocompleteInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const requestIdRef = useRef(0);
  const skipFetchRef = useRef(false);
  const lastEmittedMapsUrlRef = useRef<string | null>(null);
  const regionKey = regionCodes.join(",");

  const refreshSessionToken = useCallback(async () => {
    const { AutocompleteSessionToken } = (await google.maps.importLibrary(
      "places"
    )) as google.maps.PlacesLibrary;
    sessionTokenRef.current = new AutocompleteSessionToken();
  }, []);

  const updateMenuPosition = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuBox({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions((prev) => (prev.length === 0 ? prev : []));
    setOpen((prev) => (prev ? false : prev));
    setError((prev) => (prev == null ? prev : null));
  }, []);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const onScroll = () => updateMenuPosition();
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!isLoaded) return;
    void refreshSessionToken();
  }, [isLoaded, refreshSessionToken]);

  useEffect(() => {
    if (!isLoaded) return;
    if (skipFetchRef.current) {
      skipFetchRef.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 2 || isGoogleMapsUrl(q)) {
      clearSuggestions();
      return;
    }

    const requestId = ++requestIdRef.current;
    const regions = regionKey ? regionKey.split(",") : DEFAULT_REGION_CODES;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const { AutocompleteSuggestion, AutocompleteSessionToken } =
          (await google.maps.importLibrary("places")) as google.maps.PlacesLibrary;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }
        const { suggestions: rows } =
          await AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: q,
            sessionToken: sessionTokenRef.current,
            includedRegionCodes: regions,
          });
        if (requestId !== requestIdRef.current) return;
        const mapped: SuggestionRow[] = (rows || [])
          .map((s, i) => {
            const prediction = s.placePrediction;
            if (!prediction) return null;
            return {
              id: `${i}-${prediction.text?.toString?.() || i}`,
              label: prediction.text?.toString?.() || "",
              prediction,
            };
          })
          .filter(Boolean) as SuggestionRow[];
        setSuggestions(mapped);
        setOpen(mapped.length > 0);
        updateMenuPosition();
      } catch (err) {
        console.warn("[PlaceAutocomplete] suggestions failed:", err);
        if (requestId === requestIdRef.current) {
          setSuggestions([]);
          setOpen(false);
          setError("Address search unavailable. Paste a Google Maps link or click the map.");
        }
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, 280);

    return () => window.clearTimeout(timer);
  }, [value, isLoaded, regionKey, updateMenuPosition, clearSuggestions]);

  const emitMapsUrl = (url: string) => {
    if (!onMapsUrl) return;
    const trimmed = url.trim();
    if (!trimmed || lastEmittedMapsUrlRef.current === trimmed) return;
    lastEmittedMapsUrlRef.current = trimmed;
    onMapsUrl(trimmed);
  };

  const pickSuggestion = async (row: SuggestionRow) => {
    skipFetchRef.current = true;
    setOpen(false);
    setSuggestions([]);
    try {
      const place = row.prediction.toPlace();
      await place.fetchFields({
        fields: ["formattedAddress", "location", "displayName"],
      });
      const loc = place.location;
      if (!loc) return;
      const lat = typeof loc.lat === "function" ? loc.lat() : Number(loc.lat);
      const lng = typeof loc.lng === "function" ? loc.lng() : Number(loc.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const address =
        place.formattedAddress ||
        place.displayName ||
        row.label ||
        `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      onChange(address);
      onPlaceSelect({ address, lat, lng });
      await refreshSessionToken();
    } catch (err) {
      console.warn("[PlaceAutocomplete] place details failed:", err);
      onChange(row.label);
    }
  };

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => {
          if (suggestions.length > 0) {
            setOpen(true);
            updateMenuPosition();
          }
          onFocus?.(e);
        }}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData("text");
          if (onMapsUrl && isGoogleMapsUrl(pasted)) {
            e.preventDefault();
            onChange(pasted.trim());
            emitMapsUrl(pasted);
            setOpen(false);
          }
        }}
        onBlur={(e) => {
          // Delay so suggestion click registers first.
          window.setTimeout(() => setOpen(false), 180);
          if (isGoogleMapsUrl(value)) emitMapsUrl(value);
          onBlur?.(e);
        }}
        placeholder={placeholder}
        className={className}
        style={style}
        autoComplete="off"
      />
      {loading && (
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
          …
        </div>
      )}
      {error && (
        <p className="mt-1 text-[10px] font-semibold text-amber-700">{error}</p>
      )}
      {open &&
        menuBox &&
        typeof document !== "undefined" &&
        createPortal(
          <ul
            className="fixed z-[100000] max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-2xl"
            style={{
              top: menuBox.top,
              left: menuBox.left,
              width: menuBox.width,
            }}
            role="listbox"
          >
            {suggestions.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-blue-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void pickSuggestion(row)}
                >
                  {row.label}
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
}
