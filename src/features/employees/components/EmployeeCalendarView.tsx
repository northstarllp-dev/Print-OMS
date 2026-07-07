"use client";

import React, { useState } from "react";
import { Clock, MapPin, ChevronLeft, ChevronRight, Phone } from "lucide-react";
import { Order, Customer, Employee } from "@/types";

interface EmployeeCalendarViewProps {
  orders: Order[];
  customers: Customer[];
  currentEmployee: Employee;
}

export const EmployeeCalendarView: React.FC<EmployeeCalendarViewProps> = ({ orders, customers, currentEmployee }) => {
  const [currentMonth, setCurrentMonth] = useState("October 2023");

  const empName = currentEmployee?.name || "Amit Sharma";
  const mySchedule = orders
    .filter(o => o.assignedEmployees.includes(empName) && o.stage !== "Completed" && o.stage !== "Closed")
    .map(o => {
      const client = customers.find(c => c.id === o.customerId);
      const isSiteVisit = o.stage === "Site Visit Pending" || o.stage === "Site Visit Scheduled" || o.stage === "Site Visit Completed";
      return {
        id: o.id,
        projectName: o.businessName,
        clientName: o.clientName || (client ? client.name : "Unknown Client"),
        clientPhone: client ? client.phone : "",
        stage: o.stage,
        type: isSiteVisit ? "Site Survey & Audits" : "Signage Installation",
        date: isSiteVisit ? "2023-10-24" : "2023-10-28", // Mock dates matching the database
        time: isSiteVisit ? "11:30 AM" : "02:00 PM",
        address: client ? client.shippingAddress : "Mumbai Hub",
      };
    });

  return (
    <div className="space-y-6" style={{ padding: "24px 24px 32px" }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="prt-page-title">
            Schedule & Site Visits
          </h1>
          <p className="prt-page-subtitle">
            Track scheduled site audits, measurements, and installation timelines
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-white border border-[var(--border)] rounded-[var(--radius-lg)] p-1">
          <button className="p-1 hover:bg-slate-50 rounded text-slate-550 cursor-pointer"><ChevronLeft size={16} /></button>
          <span className="text-xs font-bold text-slate-700 px-2">{currentMonth}</span>
          <button className="p-1 hover:bg-slate-50 rounded text-slate-550 cursor-pointer"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Mock Calendar Grid (Visual only) */}
        <div className="lg:col-span-8 prt-card p-5">
          <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
            <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {/* September padding days */}
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`pad-${i}`} className="aspect-square bg-slate-50/50 text-slate-300 text-xs p-1.5 rounded-[var(--radius-md)] font-semibold border border-transparent">
                {26 + i}
              </div>
            ))}
            {/* October days */}
            {Array.from({ length: 31 }).map((_, i) => {
              const day = i + 1;
              const isAuditDay = day === 24;
              const isInstallDay = day === 28;
              
              return (
                <div 
                  key={`day-${day}`} 
                  className={`aspect-square p-1.5 text-xs font-semibold rounded-[var(--radius-md)] border flex flex-col justify-between transition-colors ${
                    isAuditDay 
                      ? "bg-indigo-50/60 border-indigo-200 text-indigo-700" 
                      : isInstallDay 
                      ? "bg-cyan-50/60 border-cyan-200 text-cyan-700"
                      : "bg-white border-[var(--border)] text-slate-700 hover:bg-slate-50/50"
                  }`}
                >
                  <span className="block">{day}</span>
                  {isAuditDay && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 block self-end animate-pulse"></span>
                  )}
                  {isInstallDay && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 block self-end"></span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Agenda List */}
        <div className="lg:col-span-4 space-y-4">
          <h3 className="prt-label">Scheduled Tasks Agenda</h3>
          
          <div className="space-y-3">
            {mySchedule.map(item => (
              <div 
                key={item.id} 
                className="p-4 bg-white border border-[var(--border)] rounded-[var(--radius-xl)] space-y-3 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <span className={`prt-badge border uppercase text-[9px] ${
                    item.type === "Site Survey & Audits" 
                      ? "bg-indigo-50 text-indigo-700 border-indigo-200" 
                      : "bg-cyan-50 text-cyan-700 border-cyan-200"
                  }`}>
                    {item.type}
                  </span>

                </div>

                <div>
                  <h4 className="font-bold text-slate-800 text-sm">{item.projectName}</h4>
                  <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">Client: {item.clientName}</span>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-50 text-xs text-slate-600 font-medium">
                  <div className="flex items-center">
                    <Clock size={12} className="mr-2 text-slate-400" />
                    <span>{item.date} at {item.time}</span>
                  </div>
                  <div className="flex items-center">
                    <MapPin size={12} className="mr-2 text-slate-400 shrink-0" />
                    <span className="truncate">{item.address}</span>
                  </div>
                  {item.clientPhone && (
                    <div className="flex items-center">
                      <Phone size={12} className="mr-2 text-slate-400" />
                      <span>{item.clientPhone}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {mySchedule.length === 0 && (
              <div className="bg-slate-50 border border-slate-200 border-dashed rounded-[var(--radius-xl)] p-8 text-center text-slate-400 text-xs font-semibold">
                No site audits or installations scheduled.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
