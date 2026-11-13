import { handleSupabaseError, supabase } from "$api/services/common";

export interface TermRecord {
  termId: number;
  term: string;
  ay: string;
  termType: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
}

function mapRow(row: any): TermRecord {
  return {
    termId: Number(row.term_id),
    term: row.term,
    ay: row.ay,
    termType: row.term_type ?? null,
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    isActive: Boolean(row.is_active)
  };
}

export const termService = {
  async getTerms(): Promise<TermRecord[]> {
    if (!supabase) {
      return [];
    }
    const { data, error } = await supabase
      .from("terms")
      .select("*")
      .order("term_id", { ascending: false });

    if (error) {
      handleSupabaseError(error);
    }

    return (data || []).map(mapRow);
  },

  async getActiveTerm(): Promise<TermRecord | null> {
    if (!supabase) {
      return null;
    }
    const { data, error } = await supabase
      .from("terms")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      handleSupabaseError(error);
    }

    return data ? mapRow(data) : null;
  },

  async upsertTerm(record: TermRecord): Promise<TermRecord> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { data, error } = await supabase
      .from("terms")
      .upsert(
        {
          term_id: record.termId,
          term: record.term,
          ay: record.ay,
          term_type: record.termType,
          start_date: record.startDate,
          end_date: record.endDate,
          is_active: record.isActive,
          updated_at: new Date().toISOString()
        },
        { onConflict: "term_id" }
      )
      .select()
      .single();

    if (error) {
      handleSupabaseError(error);
    }

    return mapRow(data);
  },

  async setActiveTerm(termId: number): Promise<void> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { error: clearError } = await supabase
      .from("terms")
      .update({ is_active: false })
      .eq("is_active", true);

    if (clearError) {
      handleSupabaseError(clearError);
    }

    const { error } = await supabase
      .from("terms")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("term_id", termId);

    if (error) {
      handleSupabaseError(error);
    }
  }
};
