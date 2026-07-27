import { constantsService } from "$api/services/constants-service";
import type { ConstantRecord } from "$lib/types";

export async function fetchConstants(forceRefresh = false): Promise<ConstantRecord[]> {
  return constantsService.fetchConstants(forceRefresh);
}

export async function fetchConstantByKey(key: string): Promise<string | null> {
  return constantsService.fetchConstantByKey(key);
}

export async function fetchTermCurr(forceRefresh = false): Promise<string> {
  const val = await constantsService.fetchConstantByKey("TERM_CURR");
  return val || "";
}

export async function fetchTransactionTypes(
  forceRefresh = false
): Promise<{ value: string; label: string }[]> {
  const constants = await constantsService.fetchConstants(forceRefresh);
  return constants
    .filter((c) => c.key.startsWith("PMT_"))
    .map((c) => ({
      value: c.value || c.key,
      label: c.description || c.value || c.key
    }));
}

export async function fetchMopTypes(
  forceRefresh = false
): Promise<{ value: string; label: string }[]> {
  const constants = await constantsService.fetchConstants(forceRefresh);
  return constants
    .filter((c) => c.key.startsWith("MOP_"))
    .map((c) => ({
      value: c.value || c.key,
      label: c.description || c.value || c.key
    }));
}

export async function addConstant(key: string, value: string, description = ""): Promise<void> {
  return constantsService.addConstant(key, value, description);
}

export async function updateConstant(key: string, value: string): Promise<void> {
  return constantsService.updateConstant(key, value);
}

export async function batchUpdateConstants(
  updates: { range: string; values: any[][] }[]
): Promise<void> {
  return constantsService.batchUpdateConstants(updates);
}
