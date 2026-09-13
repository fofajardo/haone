import { env } from "$env/dynamic/public";

type FeatureList = { [key: string]: any };
const featureFlags: FeatureList = JSON.parse(env.PUBLIC_FEATURE_LIST)

/**
 * checks if the feature flag is enabled by searching the environment variable PUBLIC_FEATURE_LIST.
 * @param theFeatureFlag the feature flag to look for
 * @param theDefault the default value to return in case of an absent value
 * @returns the value specified at the feature flag. it returns `theDefault` if not set in the feature list.
 */
export function getFeatureFlagValue<T>(theFeatureFlag: string, theDefault: T): T {
  if (theFeatureFlag in featureFlags) {
    return featureFlags[theFeatureFlag];
  }
  return theDefault;
}

/**
 * checks if the list of feature flags are enabled by searching the environment variable PUBLIC_FEATURE_LIST.
 * the feature flags that are to be checked must be of the same type!
 * @param theFeatureFlag the feature flags to look for
 * @param theDefault the default value to return in case of an absent value
 * @returns the values specified at each corresponding feature flag in order. it returns `theDefault` if not set in the feature list.
 */
export function getFeatureFlagValueMulti<T>(theFeatureFlag: string[], theDefault: T): T[] {
  const e = theFeatureFlag.map((x) => getFeatureFlagValue(x, theDefault));
  return e;
}

/**
 * checks if the list of feature flags are enabled in the server by fetching.
 * the feature flags that are to be checked must be of the same type!
 * @param theFeatureFlag the feature flag to look for
 * @param theDefault the default value to return in case of an absent value
 * @returns the value specified at each corresponding feature flag in order. it returns `theDefault` if not set in the feature list.
 */
export async function fetchFeatureFlagMulti<T>(theFeatureFlags: string[], theDefault: T): Promise<T[]> {
  const params = new URLSearchParams({ features: theFeatureFlags.join(";") })
  return (JSON.parse(await 
    (await (fetch(`/api/features?${params.toString()}`))).text()) as T[])
    .map((x) => x === null ? theDefault : x);
}