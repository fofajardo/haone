import { CONSTANT_COL } from "$lib/types";

/**
 * checks if the feature flag is enabled by searching the given constant rows.
 * @param constantRows constant rows that was retrieved from the constants table (spreadsheet) (database or whatever)
 * @param theFeatureFlag the feature flag to look for
 * @returns `true` if the feature flag is set to enabled, `false` otherwise. it returns `true` if not set in the constants table.
 */
export function isFeatureFlagEnabledDirect(constantRows: any[][], theFeatureFlag: string): boolean {
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