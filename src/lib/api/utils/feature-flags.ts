import { CONSTANT_COL } from "$lib/types";

export function isFeatureFlagEnabled(constantRows: any[][], theFeatureFlag: string): boolean {
  const featureFlag = constantRows.find((r: any) => {
    return (
      (r[CONSTANT_COL.KEY] || "").trim() === theFeatureFlag
    );
  });

  if (featureFlag) {
    return ((featureFlag[CONSTANT_COL.VALUE] || "true") as string).trim().toLowerCase() === "true";
  }
  return false;
}