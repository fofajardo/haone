import { constantsService } from "$api/services/constants-service";
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

/**
 * checks if the feature flag is enabled by making a fetch from ConstantsService... which looks at the constant table.
 * @throws this function is CLIENT ONLY. an error might be thrown that MIGHT crash the server if this method were to be ran on the server.
 * @param theFeatureFlag the feature flag to lok for
 * @param bypassCache an optional argument when if `false`, relies on the cache; and if `true`, does not use the cache,
 *        which may be useful for forceful updates.
 * @returns `true` if the feature flag is set to enabled, `false` otherwise. it returns `true` if not set in the constants table.
 */
export async function isFeatureFlagEnabledFetch(theFeatureFlag: string, bypassCache = false): Promise<boolean> {
  const val = await constantsService.fetchConstantByKey(theFeatureFlag);
  return (val || "true").toLowerCase() === "true";
}