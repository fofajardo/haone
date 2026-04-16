import { browser } from "$app/environment";
import { LS_KEYS } from "./constants";

export type UIFont = "inter" | "archivo" | "shantell";
export type DisplayDensity = "compact" | "default" | "comfortable";

class UISettings {
  #fontFamily = $state<UIFont>("inter");
  #reducedMotion = $state(false);
  #displayDensity = $state<DisplayDensity>("default");

  constructor() {
    if (browser) {
      this.#fontFamily = (localStorage.getItem(LS_KEYS.UI_FONT) as UIFont) || "inter";
      this.#reducedMotion = localStorage.getItem(LS_KEYS.ACC_REDUCED_MOTION) === "true";
      this.#displayDensity =
        (localStorage.getItem("halsk.acc.display_density") as DisplayDensity) || "default";
    }
  }

  get fontFamily() {
    return this.#fontFamily;
  }
  set fontFamily(v: UIFont) {
    this.#fontFamily = v;
    if (browser) localStorage.setItem(LS_KEYS.UI_FONT, v);
  }

  get reducedMotion() {
    return this.#reducedMotion;
  }
  set reducedMotion(v: boolean) {
    this.#reducedMotion = v;
    if (browser) localStorage.setItem(LS_KEYS.ACC_REDUCED_MOTION, String(v));
  }

  get displayDensity() {
    return this.#displayDensity;
  }
  set displayDensity(v: DisplayDensity) {
    this.#displayDensity = v;
    if (browser) localStorage.setItem("halsk.acc.display_density", v);
  }
}

export const uiSettings = new UISettings();
