"use client";

import React, { useState } from "react";
import {
  X,
  Lock,
  MapPin,
  Calendar,
  Clock,
  Ruler,
  Zap,
  Building2,
  Camera,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { SiteVisitDetails, SignLocation } from "@/types";

interface SiteVisitReviewModalProps {
  siteVisit: SiteVisitDetails;
  orderName: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

function InfoChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-3 border border-slate-200/80">
      <div className="mt-0.5 text-slate-400 shrink-0">{icon}</div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
          {label}
        </p>
        <p className="text-sm font-semibold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex flex-col items-center bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 min-w-[72px]">
      <span className="text-xs font-black text-indigo-700">
        {value}
      </span>
      <span className="text-[10px] text-indigo-400 font-semibold mt-0.5">{label}</span>
    </div>
  );
}

function Tag({ text }: { text: string }) {
  return (
    <span className="inline-block bg-slate-100 text-slate-700 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-slate-200">
      {text}
    </span>
  );
}

function LocationReviewCard({ loc, index }: { loc: SignLocation; index: number }) {
  const [open, setOpen] = useState(true);
  const hasMeasurements = loc.width || loc.height || loc.depth || loc.groundClearance;
  const hasElectrical = loc.powerAvailable !== undefined || loc.distanceToPowerSource || loc.electricalNotes;
  const hasStructural = loc.wallType || loc.mountingMethod || loc.surfaceCondition || (loc.obstacles?.length ?? 0) > 0 || loc.structuralNotes;

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-[var(--color-secondary)] text-white flex items-center justify-center text-[11px] font-black shrink-0">
            {index + 1}
          </div>
          <span className="text-sm font-extrabold text-slate-800">
            {loc.name || `Item-${index + 1}`}
          </span>
        </div>
        {open ? (
          <ChevronUp size={16} className="text-slate-400" />
        ) : (
          <ChevronDown size={16} className="text-slate-400" />
        )}
      </button>

      {open && (
        <div className="p-5 space-y-5">
          {/* Measurements */}
          {hasMeasurements && (
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <Ruler size={13} className="text-slate-500" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Dimensions
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatPill label="Width" value={loc.width ? `${loc.width} ${loc.widthUnit || 'ft'}` : null} />
                <StatPill label="Height" value={loc.height ? `${loc.height} ${loc.heightUnit || 'ft'}` : null} />
                <StatPill label="Depth" value={loc.depth ? `${loc.depth} ${loc.depthUnit || 'ft'}` : null} />
                <StatPill label="Ground Clr." value={loc.groundClearance ? `${loc.groundClearance} ${loc.groundClearanceUnit || 'ft'}` : null} />
              </div>
            </div>
          )}

          {/* Notes */}
          {loc.notes && (
            <div className="bg-slate-50 border-l-4 border-slate-300 rounded-r-xl px-4 py-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Location Notes
              </p>
              <p className="text-xs text-slate-700 leading-relaxed">{loc.notes}</p>
            </div>
          )}

          {/* Photos */}
          {(loc.photos?.length ?? 0) > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Camera size={13} className="text-slate-500" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Site Photos ({loc.photos?.length || 0})
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {loc.photos?.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-16 h-16 rounded-xl overflow-hidden border border-slate-200 hover:opacity-90 transition-opacity shrink-0"
                  >
                    <img
                      src={url}
                      alt={`Photo ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Electrical */}
          {hasElectrical && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap size={13} className="text-amber-600" />
                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                  Electrical Assessment
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {loc.powerAvailable !== undefined && (
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                      loc.powerAvailable
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-red-50 text-red-700 border-red-200"
                    }`}
                  >
                    {loc.powerAvailable ? "Power Available" : "No Power Source"}
                  </span>
                )}
                {loc.distanceToPowerSource && (
                  <Tag
                    text={`${loc.distanceToPowerSource} ${loc.distanceToPowerSourceUnit || "m"} to power`}
                  />
                )}
              </div>
              {loc.electricalNotes && (
                <p className="text-xs text-amber-800 leading-relaxed mt-1">
                  {loc.electricalNotes}
                </p>
              )}
            </div>
          )}

          {/* Structural */}
          {hasStructural && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Building2 size={13} className="text-indigo-600" />
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                  Structural Assessment
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {loc.wallType && <Tag text={loc.wallType} />}
                {loc.mountingMethod && <Tag text={loc.mountingMethod} />}
                {loc.surfaceCondition && <Tag text={loc.surfaceCondition} />}
                {loc.obstacles?.map((obs, i) => (
                  <Tag key={i} text={obs} />
                ))}
              </div>
              {loc.structuralNotes && (
                <p className="text-xs text-indigo-800 leading-relaxed mt-1">
                  {loc.structuralNotes}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const SiteVisitReviewModal: React.FC<SiteVisitReviewModalProps> = ({
  siteVisit,
  orderName,
  onConfirm,
  onClose,
}) => {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  const scheduledDate = siteVisit.auditDate || siteVisit.preferredDate;
  const scheduledTime = siteVisit.auditTime || siteVisit.preferredTime;
  const locations = siteVisit.locations || [];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200">
        {/* ── Sticky Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
              <Lock size={17} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">
                Review & Confirm Site Visit
              </h2>
              <p className="text-xs text-slate-500 font-medium">{orderName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {/* Visit Info */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              Scheduled Visit Info
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoChip
                icon={<Calendar size={15} />}
                label="Date"
                value={scheduledDate}
              />
              <InfoChip
                icon={<Clock size={15} />}
                label="Time"
                value={scheduledTime}
              />
              <InfoChip
                icon={<MapPin size={15} />}
                label="Site Address"
                value={siteVisit.customerAddress}
              />
              {siteVisit.landmark && (
                <InfoChip
                  icon={<MapPin size={15} />}
                  label="Landmark"
                  value={siteVisit.landmark}
                />
              )}
              {siteVisit.gpsLocation && (
                <InfoChip
                  icon={<MapPin size={15} />}
                  label="GPS"
                  value={siteVisit.gpsLocation}
                />
              )}
            </div>
          </div>

          {/* Locations */}
          {locations.length > 0 ? (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                Sign Items & Measurements ({locations.length})
              </p>
              <div className="space-y-3">
                {locations.map((loc, i) => (
                  <LocationReviewCard key={loc.id} loc={loc} index={i} />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <p className="text-sm font-semibold text-slate-500">
                No sign items recorded
              </p>
              <p className="text-xs text-slate-400 mt-1">
                You can still confirm, but it's recommended to add measurements first.
              </p>
            </div>
          )}

          {/* ── Installation Requirements ── */}
          {(siteVisit.scaffoldingRequired || siteVisit.craneRequired || siteVisit.overnightInstallation !== undefined) && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                Installation Requirements
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap gap-2">
                {siteVisit.scaffoldingRequired && (
                  <span className="inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    🏗️ Scaffolding Required
                  </span>
                )}
                {siteVisit.craneRequired && (
                  <span className="inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                    🏗️ Crane Required
                  </span>
                )}
                {siteVisit.overnightInstallation !== undefined && (
                  <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full border ${siteVisit.overnightInstallation ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                    🌙 Overnight: {siteVisit.overnightInstallation ? "Yes" : "No"}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ── Fabrication Requirements ── */}
          {(siteVisit.extraAnglesRequired !== undefined || siteVisit.extraAcpSheetRequired !== undefined || siteVisit.oldBoardRemovalRequired !== undefined || siteVisit.extraWireRequired !== undefined) && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                Fabrication Requirements
              </p>
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 space-y-2">
                {[
                  { label: "Extra Angles Required", value: siteVisit.extraAnglesRequired, extra: siteVisit.extraAnglesRequired && siteVisit.extraAnglesLength ? ` (${siteVisit.extraAnglesLength})` : "" },
                  { label: "Extra ACP Sheet to Cover Gap", value: siteVisit.extraAcpSheetRequired },
                  { label: "Old Board Removal", value: siteVisit.oldBoardRemovalRequired },
                  { label: "Extra Wire Required", value: siteVisit.extraWireRequired },
                ].filter(item => item.value !== undefined).map(item => (
                  <div key={item.label} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-orange-800">{item.label}{"extra" in item ? item.extra : ""}</span>
                    <span className={`font-bold px-2 py-0.5 rounded-full border text-[10px] ${item.value ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                      {item.value ? "Yes" : "No"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Design Inputs ── */}
          {(siteVisit.designBriefAvailable || siteVisit.fabricationRequired !== undefined || siteVisit.civilWorkRequired !== undefined) && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                Design Inputs
              </p>
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-2">
                {siteVisit.designBriefAvailable && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-indigo-800">Design Brief Available</span>
                    <span className="font-bold px-2 py-0.5 rounded-full border text-[10px] bg-indigo-100 text-indigo-700 border-indigo-200">
                      {siteVisit.designBriefAvailable}
                    </span>
                  </div>
                )}
                {siteVisit.fabricationRequired !== undefined && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-indigo-800">Fabrication Required</span>
                    <span className={`font-bold px-2 py-0.5 rounded-full border text-[10px] ${siteVisit.fabricationRequired ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                      {siteVisit.fabricationRequired ? "Yes" : "No"}
                    </span>
                  </div>
                )}
                {siteVisit.civilWorkRequired !== undefined && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-indigo-800">Civil Work Required</span>
                    <span className={`font-bold px-2 py-0.5 rounded-full border text-[10px] ${siteVisit.civilWorkRequired ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                      {siteVisit.civilWorkRequired ? "Yes" : "No"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Sticky Footer ── */}
        <div className="shrink-0 border-t border-slate-100 bg-white px-6 py-4">
          {/* Warning strip */}
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4">
            <AlertTriangle size={14} className="text-amber-600 shrink-0" />
            <p className="text-xs text-amber-800 font-semibold">
              Once confirmed, this data cannot be edited. The site visit will be locked and sent for admin review.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={confirming}
              className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer disabled:opacity-60 shadow-sm shadow-emerald-200"
            >
              {confirming ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Locking...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  Confirm & Lock Site Visit
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
