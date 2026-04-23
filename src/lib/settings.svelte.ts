import { browser, dev } from "$app/environment";
import { LS_KEYS } from "./constants";
import {
  PUBLIC_GS_AW_ID,
  PUBLIC_GS_RR_ID,
  PUBLIC_GS_SR_ID,
  PUBLIC_APP_ENV,
  PUBLIC_APP_FIREBASE_ENABLED
} from "$env/static/public";

export type UIFont = "inter" | "archivo" | "shantell";
export type DisplayDensity = "default" | "compact" | "comfortable";

class UISettings {
  #fontFamily = $state<UIFont>("inter");
  #reducedMotion = $state(false);
  #displayDensity = $state<DisplayDensity>("default");
  #theme = $state<string>("system");
  #isPublicAchievementList = $state(true);
  #residentNavIds = $state<string[]>(["home", "finance", "laundry"]);
  #adminNavIds = $state<string[]>(["dashboard", "history", "residents"]);

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

      const sn = localStorage.getItem("halsk.ui.nav.res");
      if (sn) this.#residentNavIds = JSON.parse(sn);
      const an = localStorage.getItem("halsk.ui.nav.adm");
      if (an) this.#adminNavIds = JSON.parse(an);
    }
  }

  // Getters/Setters for UI (with localStorage sync as cache)
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
    if (browser) localStorage.setItem(LS_KEYS.ACC_SPACIOUS_LAYOUT, v);
  }

  get theme() {
    return this.#theme;
  }
  set theme(v: string) {
    this.#theme = v;
    if (browser) localStorage.setItem("halsk.ui.theme", v);
  }

  get isPublicAchievementList() {
    return this.#isPublicAchievementList;
  }
  set isPublicAchievementList(v: boolean) {
    this.#isPublicAchievementList = v;
  }

  get residentNavIds() {
    return this.#residentNavIds;
  }
  set residentNavIds(v: string[]) {
    this.#residentNavIds = v;
    if (browser) localStorage.setItem("halsk.ui.nav.res", JSON.stringify(v));
  }

  get adminNavIds() {
    return this.#adminNavIds;
  }
  set adminNavIds(v: string[]) {
    this.#adminNavIds = v;
    if (browser) localStorage.setItem("halsk.ui.nav.adm", JSON.stringify(v));
  }

  get currentTerm() {
    return this.#currentTerm;
  }
  set currentTerm(v: string) {
    this.#currentTerm = v;
    if (browser) localStorage.setItem("halsk.ui.current_term", v);
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

  get firebaseEnabled() {
    return PUBLIC_APP_FIREBASE_ENABLED === "true";
  }

  async syncFromServer() {
    const { fetchUserSettings } = await import("./shared-records-logic");
    const settings = await fetchUserSettings(true);
    const my = settings[0];
    if (my) {
      this.fontFamily = (my.typography as UIFont) || "inter";
      this.displayDensity = (my.density as DisplayDensity) || "default";
      this.theme = my.theme || "system";
      this.reducedMotion = !!my.isReducedMotion;
      this.isPublicAchievementList = my.isPublicAchievementList !== false;
      if (my.residentNav) this.residentNavIds = my.residentNav.split(",").filter(Boolean);
      if (my.adminNav) this.adminNavIds = my.adminNav.split(",").filter(Boolean);
    }
  }

  async save(residentId: string) {
    const { updateUserSettings } = await import("./shared-records-logic");
    await updateUserSettings(residentId, {
      typography: this.fontFamily,
      density: this.displayDensity,
      theme: this.theme,
      isReducedMotion: this.reducedMotion,
      isPublic: this.isPublicAchievementList,
      residentNav: this.residentNavIds.join(","),
      adminNav: this.adminNavIds.join(",")
    });
  }
}

export const uiSettings = new UISettings();
