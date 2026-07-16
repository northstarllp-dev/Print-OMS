import React from "react";
import { Logo } from "@/components/ui/Logo";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="animate-pulse flex items-center justify-center drop-shadow-xl">
        <Logo width={400} height={100} align="center" />
      </div>
    </div>
  );
}
