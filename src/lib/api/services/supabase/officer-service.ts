import type { OfficerServiceInterface } from "../interfaces/officer-service.interface";
import type { OfficerRecord } from "$lib/types";
import { supabase } from "../common";
import { parseDbDate } from "$utils/parsers";

export const supabaseOfficerService: OfficerServiceInterface = {
  async fetchOfficers(_forceRefresh = false): Promise<OfficerRecord[]> {
    if (!supabase) {
      return [];
    }
    const { data, error } = await supabase.from("officers").select("*").order("position");
    if (error) {
      throw error;
    }
    return (data || []).map((row: any) => ({
      id: row.id,
      position: row.position,
      name: row.name,
      nickname: row.nickname,
      email: row.email,
      fbLink: row.fb_link,
      term: row.term,
      committee: row.committee,
      birthday: row.birthday,
      status: row.status,
      raw: row
    })) as OfficerRecord[];
  },

  async addOfficer(data: Partial<OfficerRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from("officers").insert({
      position: data.position,
      name: data.name,
      nickname: data.nickname,
      email: data.email,
      fb_link: data.fbLink,
      term: data.term,
      committee: data.committee,
      birthday: parseDbDate(data.birthday),
      status: data.status || "ACTIVE"
    });
    if (error) {
      throw error;
    }
  },

  async updateOfficer(id: string, data: Partial<OfficerRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const payload: Record<string, any> = {};
    if (data.position !== undefined) {
      payload.position = data.position;
    }
    if (data.name !== undefined) {
      payload.name = data.name;
    }
    if (data.nickname !== undefined) {
      payload.nickname = data.nickname;
    }
    if (data.email !== undefined) {
      payload.email = data.email;
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

    const { error } = await supabase.from("officers").update(payload).eq("id", id);
    if (error) {
      throw error;
    }
  },

  async deleteOfficer(id: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from("officers").delete().eq("id", id);
    if (error) {
      throw error;
    }
  }
};
