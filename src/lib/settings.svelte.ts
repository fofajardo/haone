import { browser, dev } from "$app/environment";
import { LS_KEYS } from "./constants";
import { PUBLIC_GS_AW_ID, PUBLIC_GS_RR_ID, PUBLIC_APP_ENV } from "$env/static/public";

export type UIFont = "inter" | "archivo" | "shantell";
export type DisplayDensity = "default" | "compact" | "comfortable";

class UISettings {
  #fontFamily = $state<UIFont>("inter");
  #reducedMotion = $state(false);
  #displayDensity = $state<DisplayDensity>("default");
  #currentSemester = $state<string>("");
  #accountingWorkbookId = $state<string>(PUBLIC_GS_AW_ID || "");
  #residentRecordsId = $state<string>(PUBLIC_GS_RR_ID || "");

  constructor() {
    if (browser) {
      this.#fontFamily = (localStorage.getItem(LS_KEYS.UI_FONT) as UIFont) || "inter";
      this.#reducedMotion = localStorage.getItem(LS_KEYS.ACC_REDUCED_MOTION) === "true";
      this.#currentSemester = localStorage.getItem("halsk.ui.current_semester") || "";
      this.#displayDensity =
        (localStorage.getItem(LS_KEYS.ACC_SPACIOUS_LAYOUT) as DisplayDensity) || "default";
      this.#accountingWorkbookId = localStorage.getItem(LS_KEYS.GS_AW_ID) || PUBLIC_GS_AW_ID || "";
      this.#residentRecordsId = localStorage.getItem(LS_KEYS.GS_RR_ID) || PUBLIC_GS_RR_ID || "";
    }
  }

  get currentSemester() {
    return this.#currentSemester;
  }
  set currentSemester(v: string) {
    this.#currentSemester = v;
    if (browser) localStorage.setItem("halsk.ui.current_semester", v);
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

  get isDev() {
    return dev || PUBLIC_APP_ENV === "development";
  }
}

export const uiSettings = new UISettings();
