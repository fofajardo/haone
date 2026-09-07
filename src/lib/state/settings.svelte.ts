import { browser, dev } from "$app/environment";
import {
  PUBLIC_APP_ENV,
  PUBLIC_APP_FIREBASE_ENABLED,
  PUBLIC_GS_AW_ID,
  PUBLIC_GS_RR_ID,
  PUBLIC_GS_SR_ID
} from "$env/static/public";
import { LS_KEYS } from "$lib/constants";

export type UIFont = "default" | "archivo" | "shantell";
export type DisplayDensity = "default" | "compact" | "comfortable";

class UISettings {
  #fontFamily = $state<UIFont>("default");
  #reducedMotion = $state(false);
  #displayDensity = $state<DisplayDensity>("default");
  #theme = $state<string>("system");
  #isPublicAchievementList = $state(true);
  #residentNavIds = $state<string[]>(["home", "finance", "laundry"]);
  #adminNavIds = $state<string[]>(["dashboard", "history", "residents", "officers"]);
  #clockFormat = $state<"12h" | "24h">("12h");
  #showAllTimeAchievements = $state(true);

  #currentTerm = $state<string>("");
  #accountingWorkbookId = $state<string>(PUBLIC_GS_AW_ID || "");
  #residentRecordsId = $state<string>(PUBLIC_GS_RR_ID || "");
  #sharedRecordsId = $state<string>(PUBLIC_GS_SR_ID || "");

  constructor() {
    if (browser) {
      this.#fontFamily = (localStorage.getItem(LS_KEYS.UI_FONT) as UIFont) || "default";
      this.#reducedMotion = localStorage.getItem(LS_KEYS.ACC_REDUCED_MOTION) === "true";
      this.#currentTerm = localStorage.getItem("halsk.ui.current_term") || "";
      const sga = localStorage.getItem("halsk.ui.show_all_time_achievements");
      this.#showAllTimeAchievements = sga === null ? true : sga === "true";
      this.#displayDensity =
        (localStorage.getItem(LS_KEYS.ACC_SPACIOUS_LAYOUT) as DisplayDensity) || "default";
      this.#theme = localStorage.getItem("halsk.ui.theme") || "system";
      this.#accountingWorkbookId = localStorage.getItem(LS_KEYS.GS_AW_ID) || PUBLIC_GS_AW_ID || "";
      this.#residentRecordsId = localStorage.getItem(LS_KEYS.GS_RR_ID) || PUBLIC_GS_RR_ID || "";
      this.#sharedRecordsId = localStorage.getItem(LS_KEYS.GS_SR_ID) || PUBLIC_GS_SR_ID || "";
      this.#clockFormat = (localStorage.getItem("halsk.ui.clock_format") as "12h" | "24h") || "12h";

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

  get clockFormat() {
    return this.#clockFormat;
  }
  set clockFormat(v: "12h" | "24h") {
    this.#clockFormat = v;
    if (browser) localStorage.setItem("halsk.ui.clock_format", v);
  }

  get showAllTimeAchievements() {
    return this.#showAllTimeAchievements;
  }
  set showAllTimeAchievements(v: boolean) {
    this.#showAllTimeAchievements = v;
    if (browser) localStorage.setItem("halsk.ui.show_all_time_achievements", String(v));
  }

  get currentTerm() {
    return this.#currentTerm;
  }
  set currentTerm(v: string) {
    this.#currentTerm = v;
    if (browser) localStorage.setItem("halsk.ui.current_term", v);
  }

  /**
   * Canonical active-term resolution for pages that just need "the current
   * term". currentTerm is a persisted cache of the user's selected viewing
   * term; when it is unset, fall back to the system's TERM_CURR constant
   * (single source of truth) instead of filtering by an empty string.
   */
  async ensureCurrentTerm(): Promise<string> {
    if (this.#currentTerm) {
      return this.#currentTerm;
    }
    try {
      const { constantsService } = await import("$api/services/constants-service");
      const term = (await constantsService.fetchConstantByKey("TERM_CURR")) || "";
      if (term) {
        this.currentTerm = term;
      }
    } catch (e) {
      console.error("[Settings] Failed to resolve active term:", e);
    }
    return this.#currentTerm;
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
    try {
      const { fetchUserSettings } = await import("$api/controllers/settings-controller");
      const settings = await fetchUserSettings(true);
      const my = settings[0];
      if (my) {
        // Apply with individual safety checks
        if (my.typography) this.fontFamily = my.typography as UIFont;
        if (my.density) this.displayDensity = my.density as DisplayDensity;
        if (my.theme) this.theme = my.theme;
        if (my.clockFormat) this.clockFormat = my.clockFormat as "12h" | "24h";
        this.reducedMotion = !!my.isReducedMotion;
        this.isPublicAchievementList = my.isPublicAchievementList !== false;

        if (my.residentNav) {
          const nav = my.residentNav.split(",").filter(Boolean);
          if (nav.length > 0) this.residentNavIds = nav;
        }

        if (my.adminNav) {
          const nav = my.adminNav.split(",").filter(Boolean);
          if (nav.length > 0) this.adminNavIds = nav;
        }
      }
    } catch (e) {
      console.error("[Settings] Sync failed, using local/default values:", e);
    }
  }

  async save(residentId: string) {
    const { updateUserSettings } = await import("$api/controllers/settings-controller");
    await updateUserSettings(residentId, {
      typography: this.fontFamily,
      density: this.displayDensity,
      theme: this.theme,
      isReducedMotion: this.reducedMotion,
      isPublic: this.isPublicAchievementList,
      residentNav: this.residentNavIds.join(","),
      adminNav: this.adminNavIds.join(","),
      clockFormat: this.clockFormat
    });
  }
}

export const uiSettings = new UISettings();
