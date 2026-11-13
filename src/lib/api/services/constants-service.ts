import type { ConstantRecord } from "$lib/types";
import { assertSupabaseFound, fetchAllSupabaseRows, handleSupabaseError, supabase } from "./common";
import { termService } from "./term-service";

export const constantsService = {
  async fetchConstants(_bypassCache?: boolean): Promise<ConstantRecord[]> {
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

  async fetchTerms(
    _bypassCache?: boolean
  ): Promise<{ value: string; label: string; description: string }[]> {
    if (!supabase) {
      return [];
    }
    const terms = await termService.getTerms();
    return terms.map((t) => ({
      value: String(t.termId),
      label: `${t.ay} ${t.term}`,
      description: `${t.ay} ${t.term}`
    }));
  },

  async fetchConstantByKey(key: string, _bypassCache?: boolean): Promise<string | null> {
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
