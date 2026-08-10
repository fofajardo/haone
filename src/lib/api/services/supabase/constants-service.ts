import type { ConstantsServiceInterface } from "../interfaces/constants-service.interface";
import {
  supabase,
  handleSupabaseError,
  assertSupabaseFound,
  fetchAllSupabaseRows
} from "../common";
import type { ConstantRecord } from "$lib/types";

export const supabaseConstantsService: ConstantsServiceInterface = {
  async fetchConstants(_forceRefresh?: boolean): Promise<ConstantRecord[]> {
    if (!supabase) {
      return [];
    }
    const sb = supabase;
    const data = await fetchAllSupabaseRows(() =>
      sb.from("constants").select("*").order("key", { ascending: true })
    );
    return data.map((c: any) => ({
      key: c.key,
      value: c.value,
      description: c.description || "",
      raw: [c.key, c.value, c.description || ""]
    }));
  },

  async fetchConstantByKey(key: string): Promise<string | null> {
    if (!supabase) {
      return null;
    }
    const { data, error } = await supabase
      .from("constants")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) {
      handleSupabaseError(error);
    }
    return data?.value ?? null;
  },

  async addConstant(key: string, value: string, description = ""): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from("constants").insert({ key, value, description });
    if (error) {
      handleSupabaseError(error);
    }
  },

  async updateConstant(key: string, value: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { data, error } = await supabase
      .from("constants")
      .update({ value })
      .eq("key", key)
      .select("key");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(data, `Constant "${key}" not found`);
  },

  async batchUpdateConstants(updates: { range: string; values: any[][] }[]): Promise<void> {
    if (!supabase) {
      return;
    }
    // Sheets-shaped updates ({ range: "constants!B{row}" }) encode the target
    // constant by sheet row (1-indexed, row 1 = header). Resolve keys in the
    // same canonical order fetchConstants returns.
    const all = await this.fetchConstants();
    for (const u of updates) {
      const m = u.range.match(/(\d+)/);
      if (!m) {
        continue;
      }
      const key = all[parseInt(m[1]) - 2]?.key;
      if (!key) {
        continue;
      }
      const { error } = await supabase
        .from("constants")
        .update({ value: String(u.values[0]?.[0] ?? "") })
        .eq("key", key);
      if (error) {
        handleSupabaseError(error);
      }
    }
  }
};
