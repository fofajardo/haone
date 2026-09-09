import { privateServices } from "$srcPrivate/services";
import type { CustomServiceItem } from "$lib/types";

export function getCustomServices(target: "admin" | "resident"): CustomServiceItem[] {
  if (!Array.isArray(privateServices)) {
    return [];
  }
  return privateServices.filter((s) => s.target === target);
}
