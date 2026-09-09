import type { CustomServiceItem } from "$lib/types";
import { privateServices } from "$srcPrivate/services";

export function getCustomServices(target: "admin" | "resident"): CustomServiceItem[] {
  if (!Array.isArray(privateServices)) {
    return [];
  }
  return privateServices.filter((s) => s.target === target);
}
