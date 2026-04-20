import { browser } from "$app/environment";
import { PUBLIC_GI_CLIENT_ID } from "$env/static/public";
import { LS_KEYS } from "./constants";
import branding from "./branding.json";

export type BrandingKey = keyof typeof branding;

class BrandingState {
  #selectedKey = $state<BrandingKey>("default");

  constructor() {
    if (browser) {
      const saved = localStorage.getItem(LS_KEYS.BRANDING_PROFILE) as BrandingKey;
      if (saved && branding[saved]) {
        this.#selectedKey = saved;
      }
    }
  }

  get selectedKey() {
    return this.#selectedKey;
  }

  set selectedKey(value: BrandingKey) {
    this.#selectedKey = value;
    if (browser) {
      localStorage.setItem(LS_KEYS.BRANDING_PROFILE, value);
    }
  }

  get profile() {
    const prof = branding[this.#selectedKey] as any;
    return {
      ...prof,
      googleClientId: PUBLIC_GI_CLIENT_ID
    };
  }
}

export const brandingState = new BrandingState();
