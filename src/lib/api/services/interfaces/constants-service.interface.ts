import type { ConstantRecord } from "$lib/types";

export interface ConstantsServiceInterface {
  fetchConstants(forceRefresh?: boolean): Promise<ConstantRecord[]>;

  fetchConstantByKey(key: string): Promise<string | null>;

  addConstant(key: string, value: string, description?: string): Promise<void>;

  updateConstant(key: string, value: string): Promise<void>;

  batchUpdateConstants(updates: { range: string; values: any[][] }[]): Promise<void>;
}
