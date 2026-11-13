import { handleSupabaseError, supabase } from "$api/services/common";
import type { FeeCodeConfig } from "$lib/types";

function mapRow(row: any): FeeCodeConfig {
  return {
    id: row.id,
    label: row.label,
    shortLabel: row.short_label,
    color: row.color,
    canWaive: Boolean(row.can_waive),
    isMandatory: Boolean(row.is_mandatory),
    paymentRequestField: row.payment_request_field ?? undefined,
    sortOrder: Number(row.sort_order ?? 0)
  };
}

export const feeCodeService = {
  async getFeeCodes(): Promise<FeeCodeConfig[]> {
    if (!supabase) {
      return [];
    }
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }

    const { data, error } = await supabase
      .from("fee_codes")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      handleSupabaseError(error);
    }

    return (data || []).map(mapRow);
  },

  async upsertFeeCode(
    config: Partial<FeeCodeConfig> & {
      label: string;
      shortLabel: string;
      color: string;
      canWaive: boolean;
    }
  ): Promise<FeeCodeConfig> {
    const payload: Record<string, any> = {
      label: config.label,
      short_label: config.shortLabel,
      color: config.color,
      can_waive: config.canWaive,
      is_mandatory: config.isMandatory ?? false,
      payment_request_field: config.paymentRequestField || null,
      sort_order: config.sortOrder ?? 0
    };

    if (config.id) {
      payload.id = config.id;
    }

    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }

    const { data, error } = await supabase
      .from("fee_codes")
      .upsert(payload, { onConflict: config.id ? "id" : "label" })
      .select()
      .single();

    if (error) {
      handleSupabaseError(error);
    }

    return mapRow(data);
  },

  async deleteFeeCode(id: string): Promise<void> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }

    const { error } = await supabase.from("fee_codes").delete().eq("id", id);
    if (error) {
      handleSupabaseError(error);
    }
  }
};
