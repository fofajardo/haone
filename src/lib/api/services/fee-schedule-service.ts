import { handleSupabaseError, supabase } from "$api/services/common";

export interface FeeScheduleItem {
  id?: string;
  termId: number;
  feeCodeId: string;
  amount: number;
  collectionPeriods: number;
}

function mapRow(row: any): FeeScheduleItem {
  return {
    id: row.id,
    termId: Number(row.term_id),
    feeCodeId: row.fee_code_id,
    amount: Number(row.amount ?? 0),
    collectionPeriods: Number(row.collection_periods ?? 1)
  };
}

export const feeScheduleService = {
  async getScheduleForTerm(termId: number): Promise<FeeScheduleItem[]> {
    if (!supabase) {
      return [];
    }
    const { data, error } = await supabase.from("fee_schedule").select("*").eq("term_id", termId);

    if (error) {
      handleSupabaseError(error);
    }

    return (data || []).map(mapRow);
  },

  async upsertScheduleItems(
    termId: number,
    items: Omit<FeeScheduleItem, "id" | "termId">[]
  ): Promise<void> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const payload = items.map((item) => ({
      term_id: termId,
      fee_code_id: item.feeCodeId,
      amount: item.amount,
      collection_periods: item.collectionPeriods
    }));

    const { error } = await supabase
      .from("fee_schedule")
      .upsert(payload, { onConflict: "term_id,fee_code_id" });

    if (error) {
      handleSupabaseError(error);
    }
  }
};
