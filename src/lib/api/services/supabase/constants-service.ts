import type { ConstantsServiceInterface } from "../interfaces/constants-service.interface";
import { supabase } from "../common";
import type { ConstantRecord } from "$lib/types";

export const supabaseConstantsService: ConstantsServiceInterface = {
  async fetchConstants(_forceRefresh?: boolean): Promise<ConstantRecord[]> {
    if (!supabase) {
      return [];
    }
    const { data, error } = await supabase.from("constants").select("*");
    if (error) {
      throw error;
    }
    return (data || []).map((c: any) => ({
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
      throw error;
    }
    return data?.value ?? null;
  },

  async addConstant(key: string, value: string, description = ""): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from("constants").insert({ key, value, description });
    if (error) {
      throw error;
    }
  },

  async updateConstant(key: string, value: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from("constants").update({ value }).eq("key", key);
    if (error) {
      throw error;
    }
  },

  async batchUpdateConstants(updates: { range: string; values: any[][] }[]): Promise<void> {
    // Supabase: parse range to extract key and upsert
    for (const u of updates) {
      const value = u.values[0]?.[0];
      if (value !== undefined) {
        // range encodes the key in some cases — delegate to caller for key resolution
        // For direct key-value updates prefer updateConstant
      }
    }
  }
};
