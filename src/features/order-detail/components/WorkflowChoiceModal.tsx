"use client";

import React, { useState } from "react";
import { FileText, Palette, X, ArrowRight } from "lucide-react";
import { OverlayPortal } from "@/components/ui/OverlayPortal";

interface WorkflowChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChoose: (workflowType: "quote_first" | "design_first") => Promise<void>;
}

const PATH_QUOTE_FIRST = [
  { icon: "📍", label: "Site Visit" },
  { icon: "📄", label: "Quote" },
  { icon: "🎨", label: "Design" },
  { icon: "🏭", label: "Production" },
  { icon: "🔧", label: "Installation" },
];

const PATH_DESIGN_FIRST = [
  { icon: "📍", label: "Site Visit" },
  { icon: "🎨", label: "Design" },
  { icon: "📄", label: "Quote" },
  { icon: "🏭", label: "Production" },
  { icon: "🔧", label: "Installation" },
];

export function WorkflowChoiceModal({ isOpen, onClose, onChoose }: WorkflowChoiceModalProps) {
  const [loading, setLoading] = useState<"quote_first" | "design_first" | null>(null);

  if (!isOpen) return null;

  const handleChoose = async (type: "quote_first" | "design_first") => {
    setLoading(type);
    try {
      await onChoose(type);
    } finally {
      setLoading(null);
    }
  };

  return (
    <OverlayPortal>
    <div className="fixed inset-0 z-[100000] flex items-end md:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 md:p-5">
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-[680px] max-h-[92dvh] md:max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-[slideUp_0.3s_cubic-bezier(0.16,1,0.3,1)]">
        {/* Header */}
        <div className="px-4 py-4 md:px-6 border-b border-slate-200 flex justify-between items-start gap-3 bg-slate-50 shrink-0">
          <div className="min-w-0">
            <h2 className="m-0 text-[16px] md:text-[17px] font-extrabold text-slate-900">
              Choose Workflow Path
            </h2>
            <p className="mt-1 mb-0 text-[12px] md:text-[13px] text-slate-500 leading-snug">
              Site visit is approved. How do you want to proceed for this order?
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 -mr-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cards — stack on mobile, side-by-side on sm+ */}
        <div className="p-4 md:p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {/* Quote First */}
          <button
            type="button"
            onClick={() => handleChoose("quote_first")}
            disabled={!!loading}
            className={`text-left rounded-[14px] border-2 p-4 md:p-5 transition-all disabled:cursor-not-allowed ${
              loading === "quote_first"
                ? "bg-blue-50 border-blue-500"
                : loading
                  ? "opacity-50 border-slate-200 bg-white"
                  : "border-slate-200 bg-white hover:border-blue-500 hover:bg-blue-50"
            }`}
          >
            <div className="flex items-center gap-2.5 mb-3.5">
              <div className="w-10 h-10 bg-blue-100 rounded-[10px] flex items-center justify-center shrink-0">
                <FileText size={20} color="#2563EB" />
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-extrabold text-slate-900">Quote First</div>
                <div className="text-xs text-slate-500">Standard workflow</div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {PATH_QUOTE_FIRST.map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-[13px]">
                  <span className="text-[15px]">{step.icon}</span>
                  <span className="text-slate-700 font-medium">{step.label}</span>
                  {i < PATH_QUOTE_FIRST.length - 1 && (
                    <ArrowRight size={10} color="#CBD5E1" className="ml-auto" />
                  )}
                </div>
              ))}
            </div>
            <div
              className={`mt-4 px-3 py-2 rounded-lg text-xs font-bold text-center ${
                loading === "quote_first" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
              }`}
            >
              {loading === "quote_first" ? "Setting up..." : "Select Quote First →"}
            </div>
          </button>

          {/* Design First */}
          <button
            type="button"
            onClick={() => handleChoose("design_first")}
            disabled={!!loading}
            className={`text-left rounded-[14px] border-2 p-4 md:p-5 transition-all disabled:cursor-not-allowed ${
              loading === "design_first"
                ? "bg-purple-50 border-purple-500"
                : loading
                  ? "opacity-50 border-slate-200 bg-white"
                  : "border-slate-200 bg-white hover:border-purple-500 hover:bg-purple-50"
            }`}
          >
            <div className="flex items-center gap-2.5 mb-3.5">
              <div className="w-10 h-10 bg-purple-100 rounded-[10px] flex items-center justify-center shrink-0">
                <Palette size={20} color="#9333EA" />
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-extrabold text-slate-900">Design First</div>
                <div className="text-xs text-slate-500">Design before quote</div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {PATH_DESIGN_FIRST.map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-[13px]">
                  <span className="text-[15px]">{step.icon}</span>
                  <span className="text-slate-700 font-medium">{step.label}</span>
                  {i < PATH_DESIGN_FIRST.length - 1 && (
                    <ArrowRight size={10} color="#CBD5E1" className="ml-auto" />
                  )}
                </div>
              ))}
            </div>
            <div
              className={`mt-4 px-3 py-2 rounded-lg text-xs font-bold text-center ${
                loading === "design_first" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"
              }`}
            >
              {loading === "design_first" ? "Setting up..." : "Select Design First →"}
            </div>
          </button>
        </div>

        <style>{`
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </div>
    </OverlayPortal>
  );
}
