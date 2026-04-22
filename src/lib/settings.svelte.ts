import { browser, dev } from "$app/environment";
import { LS_KEYS } from "./constants";
import {
  PUBLIC_GS_AW_ID,
  PUBLIC_GS_RR_ID,
  PUBLIC_GS_SR_ID,
  PUBLIC_APP_ENV
} from "$env/static/public";

export type UIFont = "inter" | "archivo" | "shantell";
export type DisplayDensity = "default" | "compact" | "comfortable";

class UISettings {
  #fontFamily = $state<UIFont>("inter");
  #reducedMotion = $state(false);
  #displayDensity = $state<DisplayDensity>("default");
  #theme = $state<string>("system");
  #currentTerm = $state<string>("");
  #accountingWorkbookId = $state<string>(PUBLIC_GS_AW_ID || "");
  #residentRecordsId = $state<string>(PUBLIC_GS_RR_ID || "");
  #sharedRecordsId = $state<string>(PUBLIC_GS_SR_ID || "");

  constructor() {
    if (browser) {
      this.#fontFamily = (localStorage.getItem(LS_KEYS.UI_FONT) as UIFont) || "inter";
      this.#reducedMotion = localStorage.getItem(LS_KEYS.ACC_REDUCED_MOTION) === "true";
      this.#currentTerm = localStorage.getItem("halsk.ui.current_term") || "";
      this.#displayDensity =
        (localStorage.getItem(LS_KEYS.ACC_SPACIOUS_LAYOUT) as DisplayDensity) || "default";
      this.#theme = localStorage.getItem("halsk.ui.theme") || "system";
      this.#accountingWorkbookId = localStorage.getItem(LS_KEYS.GS_AW_ID) || PUBLIC_GS_AW_ID || "";
      this.#residentRecordsId = localStorage.getItem(LS_KEYS.GS_RR_ID) || PUBLIC_GS_RR_ID || "";
      this.#sharedRecordsId = localStorage.getItem(LS_KEYS.GS_SR_ID) || PUBLIC_GS_SR_ID || "";
    }
  }

  get currentTerm() {
    return this.#currentTerm;
  }
  set currentTerm(v: string) {
    this.#currentTerm = v;
    if (browser) localStorage.setItem("halsk.ui.current_term", v);
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
    if (browser) localStorage.setItem(LS_KEYS.ACC_REDUCED_MOTION, v ? "true" : "false");
  }

  get displayDensity() {
    return this.#displayDensity;
  }
  set displayDensity(v: DisplayDensity) {
    this.#displayDensity = v;
    if (browser) localStorage.setItem(LS_KEYS.ACC_SPACIOUS_LAYOUT, v);
  }

  get theme() {
    return this.#theme;
  }
  set theme(v: string) {
    this.#theme = v;
    if (browser) localStorage.setItem("halsk.ui.theme", v);
  }

  get accountingWorkbookId() {
    return this.#accountingWorkbookId;
  }
  set accountingWorkbookId(v: string) {
    this.#accountingWorkbookId = v;
    if (browser) localStorage.setItem(LS_KEYS.GS_AW_ID, v);
  }

  get residentRecordsId() {
    return this.#residentRecordsId;
  }
  set residentRecordsId(v: string) {
    this.#residentRecordsId = v;
    if (browser) localStorage.setItem(LS_KEYS.GS_RR_ID, v);
  }
  get sharedRecordsId() {
    return this.#sharedRecordsId;
  }
  set sharedRecordsId(v: string) {
    this.#sharedRecordsId = v;
    if (browser) localStorage.setItem(LS_KEYS.GS_SR_ID, v);
  }

  get isDev() {
    return dev || PUBLIC_APP_ENV === "development";
  }

  async syncFromServer() {
    const { fetchUserSettings } = await import("./shared-records-logic");
    const settings = await fetchUserSettings();
    const my = settings[0];
    if (my) {
      if (my.typography) this.fontFamily = my.typography as UIFont;
      if (my.density) this.displayDensity = my.density as DisplayDensity;
      if (my.theme) this.theme = my.theme;
      this.reducedMotion = my.isReducedMotion;
    }
  }

  async syncToServer(residentId: string) {
    const { updateUserSettings } = await import("./shared-records-logic");
    await updateUserSettings(residentId, {
      typography: this.fontFamily,
      density: this.displayDensity,
      theme: this.theme,
      isReducedMotion: this.reducedMotion
    });
  }
}

export const uiSettings = new UISettings();
