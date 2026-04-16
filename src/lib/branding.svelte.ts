import { browser } from "$app/environment";
import { LS_KEYS } from "./constants";
import branding from "./branding.json";

export type BrandingKey = keyof typeof branding;

class BrandingState {
  #selectedKey = $state<BrandingKey>("default");
  #spreadsheetIds = $state<Record<string, string>>({});

  constructor() {
    if (browser) {
      const saved = localStorage.getItem(LS_KEYS.BRANDING_PROFILE) as BrandingKey;
      if (saved && branding[saved]) {
        this.#selectedKey = saved;
      }

      const savedIds = localStorage.getItem(LS_KEYS.SPREADSHEET_ID);
      if (savedIds) {
        try {
          this.#spreadsheetIds = JSON.parse(savedIds);
        } catch (e) {
          console.error("Failed to parse spreadsheet IDs", e);
        }
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

  get spreadsheetId() {
    // Check localStorage overrides first, then branding.json
    return (
      this.#spreadsheetIds[this.#selectedKey] ||
      (branding[this.#selectedKey] as any).spreadsheetId ||
      ""
    );
  }

  set spreadsheetId(value: string) {
    this.#spreadsheetIds[this.#selectedKey] = value;
    if (browser) {
      localStorage.setItem(LS_KEYS.SPREADSHEET_ID, JSON.stringify(this.#spreadsheetIds));
    }
  }

  get profile() {
    return branding[this.#selectedKey] as any;
  }
}

export const brandingState = new BrandingState();
