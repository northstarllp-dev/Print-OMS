import { PrintOMSClientConfig } from "./schema";
import { theBoardCompanyConfig } from "./clients/the-board-company";
import { printecConfig } from "./clients/printec";
import { hitechVisionConfig } from "./clients/hitech-vision";
import { defaultConfig as printomsConfig } from "./clients/printoms";
import { printsquirelConfig } from "./clients/printsquirel";

export const clientRegistry: Record<string, Partial<PrintOMSClientConfig>> = {
  "the-board-company": theBoardCompanyConfig,
  "printec": printecConfig,
  "hitech-vision": hitechVisionConfig,
  "printoms": printomsConfig,
  "printsquirel": printsquirelConfig,
};
