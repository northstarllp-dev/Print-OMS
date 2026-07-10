import React from "react";
import LoadingLines from "@/components/ui/loading-lines";

interface PrintomsLoadingProps {
  fullScreen?: boolean;
}

export function PrintomsLoading({ fullScreen = false }: PrintomsLoadingProps) {
  const containerClasses = fullScreen
    ? "fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm"
    : "flex flex-col items-center justify-center p-8 w-full h-full min-h-[300px]";

  return (
    <div className={containerClasses}>
      <LoadingLines logoWidth={200} logoHeight={56} />
    </div>
  );
}
