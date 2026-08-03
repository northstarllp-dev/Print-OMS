"use client";

import React from "react";
import { Phone, Mail, Award, CheckCircle, ShieldAlert } from "lucide-react";
import { Employee } from "@/types";

interface EmployeeProfileViewProps {
  currentEmployee: Employee;
}

export const EmployeeProfileView: React.FC<EmployeeProfileViewProps> = ({ currentEmployee }) => {
  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };
  const empName = currentEmployee?.name || "Amit Sharma";
  const initials = getInitials(empName).slice(0, 2);
  return (
    <div className="space-y-6" style={{ padding: "24px 24px 32px" }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="prt-page-title">
            My Staff Profile
          </h1>
          <p className="prt-page-subtitle">
            View your designations, operational settings, and key performance ratings
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="md:col-span-1 prt-card p-6 flex flex-col items-center text-center space-y-4">
          <div className="w-24 h-24 rounded-full bg-[var(--secondary-500)] border-2 border-[var(--primary-900)] flex items-center justify-center text-3xl font-bold text-white relative">
            <span>{initials}</span>
            <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-[var(--primary-900)] border-2 border-white"></span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">{empName}</h3>
            <span className="prt-badge border bg-emerald-50 text-[var(--primary-900)] border-emerald-200 mt-1 inline-block">
              Staff / {currentEmployee?.role || "Field Agent"}
            </span>
          </div>
          <div className="w-full space-y-2 border-t border-[var(--border)] pt-4 text-xs font-medium text-slate-600">
            <div className="flex items-center space-x-2">
              <Mail size={14} className="text-slate-400" />
              <span>{currentEmployee?.email || "staff@company.com"}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Phone size={14} className="text-slate-400" />
              <span>{currentEmployee?.phone || "+91 98765 33333"}</span>
            </div>
          </div>
        </div>

        {/* Performance & Metrics */}
        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="prt-card p-5 flex items-center space-x-4">
              <div className="p-3 bg-emerald-50 text-[var(--primary-900)] rounded-[var(--radius-lg)]"><CheckCircle size={20} /></div>
              <div>
                <span className="prt-label block">Completed Tasks</span>
                <span className="text-xl font-bold text-slate-800 font-mono">14 Projects</span>
              </div>
            </div>

            <div className="prt-card p-5 flex items-center space-x-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-[var(--radius-lg)]"><Award size={20} /></div>
              <div>
                <span className="prt-label block">Lead Quality Rating</span>
                <span className="text-xl font-bold text-slate-800 font-mono">4.7 / 5.0</span>
              </div>
            </div>
          </div>

          <div className="prt-card p-6 space-y-4">
            <h4 className="prt-label">Access Scope Permissions</h4>
            
            <div className="space-y-3">
              <div className="flex items-start space-x-3 text-xs">
                <div className="p-1 bg-rose-50 text-[var(--error-text)] rounded mt-0.5"><ShieldAlert size={14} /></div>
                <div>
                  <span className="font-bold text-slate-800">No Stage Progression Clearance</span>
                  <p className="text-slate-500 leading-normal mt-0.5">As an Employee, you can upload site surveys and draft proposals but require Admin review to advance stages.</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 text-xs">
                <div className="p-1 bg-rose-50 text-[var(--error-text)] rounded mt-0.5"><ShieldAlert size={14} /></div>
                <div>
                  <span className="font-bold text-slate-800">Financial Visibility Restricted</span>
                  <p className="text-slate-500 leading-normal mt-0.5">Global cashflows, margins, and outstanding collection metrics are hidden from your terminal workspace.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
