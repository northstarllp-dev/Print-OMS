"use client";

import React, { useEffect, useState } from "react";
import { Calendar, Save, Loader2, CheckCircle, RefreshCw, MapPin } from "lucide-react";
import { scheduleInstallationAction } from "@/features/installations/actions/installationActions";
import { buildGoogleMapsSearchUrl } from "@/features/orders/actions/siteVisitMapper";

interface InstallationScheduleModuleProps {
  orderId: string;
  initialScheduledDate?: string;
  initialScheduledTime?: string;
  isCompleted?: boolean;
  isCustomerView?: boolean;
  customerSchedulingEnabled?: boolean;
  locationText?: string;
  locationLink?: string;
  onScheduled?: (payload: { scheduledDate: string; scheduledTime: string }) => void;
}

export const InstallationScheduleModule: React.FC<InstallationScheduleModuleProps> = ({
  orderId,
  initialScheduledDate = "",
  initialScheduledTime = "",
  isCompleted = false,
  isCustomerView = false,
  customerSchedulingEnabled = true,
  locationText = "",
  locationLink = "",
  onScheduled,
}) => {
  // confirmedDate tracks the *saved* value updated after a successful save
  const [confirmedDate, setConfirmedDate] = useState(initialScheduledDate);
  const [confirmedTime, setConfirmedTime] = useState(initialScheduledTime);

  // selectedDate tracks the picker selection while the form is open
  const [selectedDate, setSelectedDate] = useState(initialScheduledDate);

  const [scheduling, setScheduling] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [alert, setAlert] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Sync when parent/realtime updates scheduled date (don't clobber an open reschedule form).
  useEffect(() => {
    setConfirmedDate(initialScheduledDate);
    setConfirmedTime(initialScheduledTime);
    if (!isRescheduling) {
      setSelectedDate(initialScheduledDate);
    }
  }, [initialScheduledDate, initialScheduledTime, isRescheduling]);

  const isScheduled = !!confirmedDate;
  const showForm = !isScheduled || isRescheduling;

  const handleSchedule = async () => {
    if (!selectedDate) {
      setAlert({ message: "Please select a date.", type: "error" });
      setTimeout(() => setAlert(null), 3000);
      return;
    }
    setScheduling(true);
    try {
      await scheduleInstallationAction(orderId, { scheduledDate: selectedDate, scheduledTime: "" });
      setConfirmedDate(selectedDate);
      setConfirmedTime("");
      setIsRescheduling(false);
      onScheduled?.({ scheduledDate: selectedDate, scheduledTime: "" });
      setAlert({ message: "Installation scheduled successfully!", type: "success" });
    } catch (err: any) {
      setAlert({ message: err.message || "Failed to schedule", type: "error" });
    } finally {
      setScheduling(false);
      setTimeout(() => setAlert(null), 4000);
    }
  };

  const handleCancelReschedule = () => {
    setIsRescheduling(false);
    setSelectedDate(confirmedDate);
  };

  const getNextDays = (count: number) => {
    const days: string[] = [];
    const current = new Date();
    while (days.length < count) {
      current.setDate(current.getDate() + 1);
      // Skip Sundays (0) keep Saturdays for installation work
      if (current.getDay() !== 0) {
        days.push(current.toISOString().split("T")[0]);
      }
    }
    return days;
  };

  const nextDays = getNextDays(6);
  const mapsHref = locationLink || buildGoogleMapsSearchUrl(locationText);

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-sm min-w-0 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          <Calendar size={18} className="text-blue-600 shrink-0" />
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider truncate">
            Installation Schedule
          </h2>
        </div>

        {alert && (
          <div
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border shrink-0 ${
              alert.type === "success"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}
          >
            {alert.message}
          </div>
        )}
      </div>

      {/* Confirmed state */}
      {!showForm ? (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 sm:p-5 min-w-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
                <CheckCircle size={20} className="text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-0.5">
                  Your installation has been scheduled
                </p>
                <p className="font-black text-blue-900 text-sm sm:text-base leading-snug break-words">
                  {new Date(confirmedDate + "T00:00:00").toLocaleDateString("en-IN", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                  {confirmedTime ? ` at ${confirmedTime}` : ""}
                </p>
                {(locationText || mapsHref) && (
                  <div className="flex items-start gap-1.5 mt-2 min-w-0">
                    <MapPin size={12} className="text-blue-500 shrink-0 mt-0.5" />
                    {mapsHref ? (
                      <a
                        href={mapsHref}
                        target="_blank"
                        rel="noreferrer"
                        title={locationText || "Open in Google Maps"}
                        className="text-[11px] font-bold text-blue-600 hover:underline break-words min-w-0 active:opacity-80"
                      >
                        {locationText || "Open in Google Maps"}
                      </a>
                    ) : (
                      <span className="text-[11px] font-bold text-blue-600 break-words min-w-0" title={locationText}>
                        {locationText}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {!isCompleted && !isCustomerView && (
              <button
                onClick={() => setIsRescheduling(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white text-blue-700 font-bold text-xs rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors shadow-sm w-full sm:w-auto shrink-0"
              >
                <RefreshCw size={12} />
                Reschedule
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Scheduling form */
        isCustomerView && !customerSchedulingEnabled ? (
          <div className="py-6 text-center text-slate-500 text-sm font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Calendar size={24} className="mx-auto mb-2 opacity-30" />
            Your installation schedule is pending confirmation from our team.
          </div>
        ) : (
          <div className="min-w-0 space-y-4">
            <div className="min-w-0">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Select Date
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {nextDays.map((date) => {
                  const isSelected = selectedDate === date;
                  const dateObj = new Date(date + "T00:00:00");
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => setSelectedDate(date)}
                      disabled={isCompleted}
                      className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border transition-all ${
                        isSelected
                          ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20"
                          : "bg-white border-slate-200 hover:border-slate-300 text-slate-600"
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                        {dateObj.toLocaleDateString("en-US", { weekday: "short" })}
                      </span>
                      <span className="text-lg font-black leading-none my-1">
                        {dateObj.getDate()}
                      </span>
                      <span className="text-[10px] font-semibold opacity-80">
                        {dateObj.toLocaleDateString("en-US", { month: "short" })}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {!isCompleted && (
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                {isRescheduling && (
                  <button
                    type="button"
                    onClick={handleCancelReschedule}
                    className="w-full sm:w-auto px-4 py-2.5 bg-white text-slate-600 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSchedule}
                  disabled={scheduling || !selectedDate}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  {scheduling ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Save size={13} />
                  )}
                  {isRescheduling ? "Save New Schedule" : "Confirm Schedule"}
                </button>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
};
