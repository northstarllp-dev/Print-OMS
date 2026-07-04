"use client";

import React from "react";
import { stageModules } from "../shared/registry";
import type { OrderStage } from "../shared/types";

interface ModuleRendererProps {
  selectedStage: OrderStage;
}

export const ModuleRenderer: React.FC<ModuleRendererProps> = ({ selectedStage }) => {
  const Module = stageModules[selectedStage];
  return <Module />;
};
