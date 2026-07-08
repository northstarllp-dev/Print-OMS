import { PrintOMSClientConfig } from "./schema";
import { theBoardCompanyConfig } from "./clients/the-board-company";

export const clientRegistry: Record<string, Partial<PrintOMSClientConfig>> = {
  "the-board-company": theBoardCompanyConfig,
};
