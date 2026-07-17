"use client";

import React from "react";

export default function RootTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="prt-animate-in h-full w-full">
      {children}
    </div>
  );
}
