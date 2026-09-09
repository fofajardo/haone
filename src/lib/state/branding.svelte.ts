import { PUBLIC_BRANDING, PUBLIC_GI_CLIENT_ID } from "$env/static/public";
import branding from "$srcPrivate/branding.json";

export type BrandingKey = keyof typeof branding;

const resolvedKey: BrandingKey = PUBLIC_BRANDING as BrandingKey;

class BrandingState {
  get selectedKey(): BrandingKey {
    return resolvedKey;
  }

  get profile() {
    const prof = branding[resolvedKey] as any;
    return {
      ...prof,
      googleClientId: PUBLIC_GI_CLIENT_ID
    };
  }
}

export const brandingState = new BrandingState();
