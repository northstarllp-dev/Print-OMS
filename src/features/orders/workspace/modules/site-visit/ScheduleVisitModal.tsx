import React, { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, MapPin } from "lucide-react";
import { GoogleMap, useJsApiLoader, Autocomplete } from "@react-google-maps/api";
import { AdvancedMapMarker } from "@/components/maps/AdvancedMapMarker";
import {
  GOOGLE_MAPS_DEFAULT_OPTIONS,
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_SCRIPT_ID,
} from "@/components/maps/googleMapsConfig";
import { isGoogleMapsUrl } from "@/components/maps/mapsUrl";
import {
  ensureResolvedSiteLocation,
  resolveGoogleMapsLocation,
} from "@/components/maps/resolveGoogleMapsLocation";

const containerStyle = {
  width: "100%",
  height: "100%"
};

// Default center: India/Bangalore as an example
const defaultCenter = {
  lat: 12.9716,
  lng: 77.5946
};

interface ScheduleVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (date: string, time: string, location: string, coords: string) => Promise<void>;
  defaultAddress?: string;
}

export const ScheduleVisitModal: React.FC<ScheduleVisitModalProps> = ({ isOpen, onClose, onSchedule, defaultAddress }) => {
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [siteAddress, setSiteAddress] = useState(defaultAddress || "");
  const [gpsCoords, setGpsCoords] = useState("12.9716, 77.5946");
  
  const [mapsSearching, setMapsSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [markerPosition, setMarkerPosition] = useState(defaultCenter);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const autocompleteRef = useRef<any>(null);

  const applyLocation = useCallback((lat: number, lng: number, address?: string) => {
    setMarkerPosition({ lat, lng });
    setMapCenter({ lat, lng });
    setGpsCoords(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    if (address && !isGoogleMapsUrl(address)) setSiteAddress(address);
  }, []);

  const onPlaceChanged = () => {
    try {
      const place = autocompleteRef.current?.getPlace?.();
      const location = place?.geometry?.location;
      if (!location) return;
      const lat = typeof location.lat === "function" ? location.lat() : location.lat;
      const lng = typeof location.lng === "function" ? location.lng() : location.lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      applyLocation(lat, lng, place.formatted_address || place.name || undefined);
    } catch (err) {
      console.warn("[ScheduleVisit] onPlaceChanged ignored incomplete place:", err);
    }
  };

  const geocoder = useRef<any>(null);

  const tryResolveMapsLink = useCallback(
    async (value: string) => {
      if (!isGoogleMapsUrl(value)) return;
      setMapsSearching(true);
      try {
        const resolved = await resolveGoogleMapsLocation(value);
        if (!resolved) {
          alert("Could not open that Google Maps link. Paste a full Maps URL or search for the address.");
          return;
        }
        applyLocation(resolved.lat, resolved.lng, resolved.address);
      } catch (err) {
        console.error("[ScheduleVisit] Maps link resolve failed:", err);
        alert("Could not open that Google Maps link. Please try again.");
      } finally {
        setMapsSearching(false);
      }
    },
    [applyLocation]
  );

  useEffect(() => {
    if (isLoaded && !geocoder.current) {
      geocoder.current = new window.google.maps.Geocoder();
    }
  }, [isLoaded]);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setSiteAddress(defaultAddress || "");
  }, [isOpen, defaultAddress]);

  const reverseGeocode = (lat: number, lng: number) => {
    if (!geocoder.current) return;
    geocoder.current.geocode({ location: { lat, lng } }, (results: any, status: any) => {
      if (status === "OK" && results[0]) {
        setSiteAddress(results[0].formatted_address);
      }
    });
  };

  const onMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    applyLocation(lat, lng);
    reverseGeocode(lat, lng);
  }, [applyLocation]);

  const handleCurrentLocation = () => {
    setMapsSearching(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          applyLocation(lat, lng);
          reverseGeocode(lat, lng);
          setMapsSearching(false);
        },
        () => {
          alert("Could not detect your location. Please check your browser permissions.");
          setMapsSearching(false);
        }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
      setMapsSearching(false);
    }
  };

  if (!isOpen || typeof document === "undefined") return null;

  const getBusinessDays = () => {
    const days: Date[] = [];
    const cur = new Date();
    while (days.length < 7) {
      cur.setDate(cur.getDate() + 1);
      if (cur.getDay() !== 0) days.push(new Date(cur));
    }
    return days;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !selectedTime || !siteAddress) return;
    setSubmitting(true);
    try {
      const location = await ensureResolvedSiteLocation({
        customerAddress: siteAddress,
        gpsLocation: gpsCoords,
      });
      setSiteAddress(location.customerAddress);
      setGpsCoords(location.gpsLocation);
      await onSchedule(
        selectedDate,
        selectedTime,
        location.customerAddress,
        location.gpsLocation
      );
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to schedule site visit.");
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-end md:items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close schedule dialog"
      />
      <div
        className="relative z-10 w-full max-w-lg max-h-[min(92dvh,100%)] md:max-h-[90vh] bg-white rounded-t-2xl md:rounded-2xl shadow-xl flex flex-col overflow-hidden mx-0 md:mx-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-visit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 md:px-5 py-3.5 md:py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <h2 id="schedule-visit-title" className="text-base md:text-lg font-black text-slate-800">
            Schedule Site Visit
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-4 md:p-5">
          <form id="schedule-visit-form" onSubmit={handleSubmit} className="space-y-5">
            {/* Date Picker */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Pick a Date
              </label>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-200">
                {getBusinessDays().map((day, idx) => {
                  const ds = day.toISOString().split("T")[0];
                  const dayName = day.toLocaleDateString("en-US", { weekday: "short" });
                  const monthName = day.toLocaleDateString("en-US", { month: "short" });
                  const selected = selectedDate === ds;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => { setSelectedDate(ds); setSelectedTime(""); }}
                      className={`flex flex-col items-center p-3 rounded-xl border text-center min-w-[64px] transition-all cursor-pointer ${selected
                        ? "bg-[#eff4ff] border-[#1E40AF] text-[#1E40AF] ring-2 ring-blue-100"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                    >
                      <span className="text-[9px] uppercase tracking-wider text-slate-400">{dayName}</span>
                      <span className="text-sm font-black mt-0.5">{day.getDate()}</span>
                      <span className="text-[9px] text-slate-400">{monthName}</span>
                    </button>
                  );
                })}
              </div>

              {selectedDate && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mt-3">
                  {["10 AM - 11 AM", "11 AM - 12 PM", "12 PM - 1 PM", "1 PM - 2 PM", "2 PM - 3 PM", "3 PM - 4 PM", "4 PM - 5 PM"].map(slot => {
                    const sel = selectedTime === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedTime(slot)}
                        className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${sel 
                            ? "bg-[#eff4ff] border-[#1E40AF] text-[#1E40AF] ring-2 ring-blue-100"
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 cursor-pointer"
                          }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Location
              </label>
              {isLoaded ? (
                <Autocomplete
                  onLoad={autocomplete => (autocompleteRef.current = autocomplete)}
                  onPlaceChanged={onPlaceChanged}
                >
                  <input
                    type="text"
                    required
                    value={siteAddress}
                    onChange={e => setSiteAddress(e.target.value)}
                    onPaste={(e) => {
                      const pasted = e.clipboardData.getData("text");
                      if (isGoogleMapsUrl(pasted)) {
                        e.preventDefault();
                        setSiteAddress(pasted.trim());
                        void tryResolveMapsLink(pasted);
                      }
                    }}
                    onBlur={() => {
                      void tryResolveMapsLink(siteAddress);
                    }}
                    placeholder="Search address or paste a Google Maps link..."
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none bg-slate-50 focus:bg-white transition-all"
                  />
                </Autocomplete>
              ) : (
                <input
                  type="text"
                  required
                  value={siteAddress}
                  onChange={e => setSiteAddress(e.target.value)}
                  placeholder="Full address where signage will be installed"
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none bg-slate-50 focus:bg-white transition-all"
                />
              )}

              {/* Map visual */}
              <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                <div className="h-40 bg-[#e8edf2] relative touch-pan-y">
                  {isLoaded ? (
                    <GoogleMap
                      mapContainerStyle={containerStyle}
                      center={mapCenter}
                      zoom={14}
                      onClick={onMapClick}
                      onLoad={setMap}
                      onUnmount={() => setMap(null)}
                      options={{
                        ...GOOGLE_MAPS_DEFAULT_OPTIONS,
                        gestureHandling: "cooperative",
                      }}
                    >
                      <AdvancedMapMarker map={map} position={markerPosition} />
                    </GoogleMap>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                      Loading Map...
                    </div>
                  )}
                </div>
                <div className="px-3 py-2 bg-white border-t border-slate-200 flex items-center justify-between">
                  <span className="text-[10px] font-mono font-semibold text-slate-600">📍 {gpsCoords}</span>
                  <button
                    type="button"
                    onClick={handleCurrentLocation}
                    className="flex items-center gap-1 text-[10px] font-bold text-[#1E40AF] hover:underline cursor-pointer"
                  >
                    {mapsSearching ? "Detecting..." : "Use Current Location"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
        <div className="px-4 md:px-5 py-3.5 md:py-4 border-t border-slate-100 bg-slate-50 flex flex-col-reverse md:flex-row justify-end gap-2 shrink-0 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200/50 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="schedule-visit-form"
            disabled={!selectedDate || !selectedTime || !siteAddress || submitting}
            className="px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors shadow-sm"
          >
            {submitting ? "Scheduling..." : "Schedule Visit"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
