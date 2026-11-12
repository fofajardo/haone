import type { OfficerRecord } from "$lib/types";
import { OfficerStatus } from "$lib/types";
import { auth } from "$state/auth.svelte";
import { isUuid, parseDbDate } from "$utils/parsers";
import { assertSupabaseFound, fetchAllSupabaseRows, handleSupabaseError, supabase } from "./common";

export interface OfficerServiceInterface {
  fetchOfficers(bypassCache?: boolean): Promise<OfficerRecord[]>;

  addOfficer(data: Partial<OfficerRecord>): Promise<void>;

  updateOfficer(id: string, data: Partial<OfficerRecord>): Promise<void>;

  deleteOfficer(id: string): Promise<void>;
}

function mapRow(row: any, user?: any): OfficerRecord {
  return {
    id: row.id,
    residentId: row.resident_id || "",
    position: row.position || "",
    name: row.name || user?.display_name || "",
    nickname: row.nickname || "",
    email: user?.email || "",
    fbLink: row.fb_link || "",
    term: row.term || "",
    committee: row.committee || "",
    birthday: row.birthday || "",
    status: row.status || OfficerStatus.ACTIVE,
    raw: row
  };
}

export const officerService: OfficerServiceInterface = {
  async fetchOfficers(_bypassCache = false): Promise<OfficerRecord[]> {
    if (!supabase) {
      return [];
    }

    if (auth.isResident) {
      const { data: constData } = await supabase
        .from("constants")
        .select("value")
        .eq("key", "TERM_CURR")
        .maybeSingle();
      const activeTerm = constData?.value || "";

      const { data, error } = await supabase
        .from("officers")
        .select("id, resident_id, position, name, nickname, term, committee, status, created_at")
        .eq("status", OfficerStatus.ACTIVE)
        .eq("term", activeTerm)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
      if (error) {
        handleSupabaseError(error);
      }
      return (data || [])
        .filter((row: any) => row.position)
        .map((row: any) => ({
          ...mapRow(row),
          email: "",
          fbLink: "",
          birthday: ""
        }));
    }

    const sb = supabase;
    const [data, usersRes] = await Promise.all([
      fetchAllSupabaseRows(() =>
        sb
          .from("officers")
          .select("*")
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
      ),
      sb.from("users_view").select("id, email, display_name")
    ]);

    if (usersRes.error) {
      handleSupabaseError(usersRes.error);
    }

    const userMap = new Map<string, any>();
    (usersRes.data || []).forEach((u: any) => {
      if (u.id) {
        userMap.set(u.id, u);
      }
    });

    return data
      .filter((row: any) => row.resident_id)
      .map((row: any) => mapRow(row, userMap.get(row.resident_id)));
  },

  async addOfficer(data: Partial<OfficerRecord>): Promise<void> {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.from("officers").insert({
      id: data.id || crypto.randomUUID(),
      resident_id: data.residentId,
      position: data.position,
      name: data.name,
      nickname: data.nickname,
      fb_link: data.fbLink,
      term: data.term,
      committee: data.committee,
      birthday: parseDbDate(data.birthday),
      status: data.status || OfficerStatus.ACTIVE
    });
    if (error) {
      handleSupabaseError(error);
    }
  },

  async updateOfficer(id: string, data: Partial<OfficerRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const payload: Record<string, any> = {};
    if (data.residentId !== undefined && isUuid(data.residentId)) {
      payload.resident_id = data.residentId;
    }
    if (data.position !== undefined) {
      payload.position = data.position;
    }
    if (data.name !== undefined) {
      payload.name = data.name;
    }
    if (data.nickname !== undefined) {
      payload.nickname = data.nickname;
    }
    if (data.fbLink !== undefined) {
      payload.fb_link = data.fbLink;
    }
    if (data.term !== undefined) {
      payload.term = data.term;
    }
    if (data.committee !== undefined) {
      payload.committee = data.committee;
    }
    if (data.birthday !== undefined) {
      payload.birthday = parseDbDate(data.birthday);
    }
    if (data.status !== undefined) {
      payload.status = data.status;
    }

    const { data: updated, error } = await supabase
      .from("officers")
      .update(payload)
      .eq("id", id)
      .select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(updated, "Officer not found");
  },

  async deleteOfficer(id: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { data, error } = await supabase.from("officers").delete().eq("id", id).select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(data, "Officer not found");
  }
};
