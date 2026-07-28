import type { AnnouncementServiceInterface } from "../interfaces/announcement-service.interface";
import type { AnnouncementRecord, PaginationOptions, PaginatedResponse } from "$lib/types";
import { supabase } from "../common";

export const supabaseAnnouncementService: AnnouncementServiceInterface = {
  async fetchAnnouncements(
    options?: PaginationOptions,
    activeOnly = false
  ): Promise<AnnouncementRecord[] | PaginatedResponse<AnnouncementRecord>> {
    if (!supabase) {
      return [];
    }

    let query = supabase.from("announcements").select("*", { count: "exact" });

    if (activeOnly) {
      const now = new Date().toISOString();
      query = query
        .eq("is_admin_only", false)
        .eq("is_unlisted", false)
        .or(`start_date.is.null,start_date.lte.${now}`)
        .or(`is_indefinite.eq.true,expiry_date.is.null,expiry_date.gte.${now}`);
    }

    query = query.order("created_at", { ascending: false });

    if (options?.page && options?.pageSize) {
      const start = (options.page - 1) * options.pageSize;
      const end = start + options.pageSize - 1;
      query = query.range(start, end);
    }

    const { data, count, error } = await query;
    if (error) {
      throw error;
    }

    const items: AnnouncementRecord[] = (data || []).map((row: any) => ({
      id: row.id,
      creatorId: row.creator_id,
      dateCreated: row.created_at,
      startDate: row.start_date,
      expiryDate: row.expiry_date,
      isIndefinite: row.is_indefinite,
      isAdminOnly: row.is_admin_only,
      isUnlisted: row.is_unlisted,
      tags: row.tags ? row.tags.join(",") : "",
      title: row.title,
      content: row.content,
      slug: row.slug,
      broadcastCount: row.broadcast_count,
      raw: row
    }));

    if (options?.page && options?.pageSize) {
      const totalCount = count || 0;
      return {
        items,
        totalCount,
        page: options.page,
        pageSize: options.pageSize,
        totalPages: Math.ceil(totalCount / options.pageSize)
      };
    }

    return items;
  },

  async fetchAnnouncementBySlug(slug: string): Promise<AnnouncementRecord | null> {
    if (!supabase) {
      return null;
    }
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      creatorId: data.creator_id,
      dateCreated: data.created_at,
      startDate: data.start_date,
      expiryDate: data.expiry_date,
      isIndefinite: data.is_indefinite,
      isAdminOnly: data.is_admin_only,
      isUnlisted: data.is_unlisted,
      tags: data.tags ? data.tags.join(",") : "",
      title: data.title,
      content: data.content,
      slug: data.slug,
      broadcastCount: data.broadcast_count,
      raw: data
    };
  },

  async addAnnouncement(data: Partial<AnnouncementRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from("announcements").insert({
      creator_id: data.creatorId,
      start_date: data.startDate,
      expiry_date: data.expiryDate,
      is_indefinite: data.isIndefinite,
      is_admin_only: data.isAdminOnly,
      is_unlisted: data.isUnlisted,
      tags: data.tags ? data.tags.split(",") : [],
      title: data.title,
      content: data.content,
      slug: data.slug
    });
    if (error) {
      throw error;
    }
  },

  async updateAnnouncement(id: string, data: Partial<AnnouncementRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const payload: Record<string, any> = {};
    if (data.title !== undefined) {
      payload.title = data.title;
    }
    if (data.content !== undefined) {
      payload.content = data.content;
    }
    if (data.startDate !== undefined) {
      payload.start_date = data.startDate;
    }
    if (data.expiryDate !== undefined) {
      payload.expiry_date = data.expiryDate;
    }
    if (data.isIndefinite !== undefined) {
      payload.is_indefinite = data.isIndefinite;
    }
    if (data.isAdminOnly !== undefined) {
      payload.is_admin_only = data.isAdminOnly;
    }
    if (data.isUnlisted !== undefined) {
      payload.is_unlisted = data.isUnlisted;
    }
    if (data.tags !== undefined) {
      payload.tags = data.tags ? data.tags.split(",") : [];
    }
    if (data.slug !== undefined) {
      payload.slug = data.slug;
    }

    const { error } = await supabase.from("announcements").update(payload).eq("id", id);
    if (error) {
      throw error;
    }
  },

  async expireAnnouncement(id: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase
      .from("announcements")
      .update({ expiry_date: today, is_indefinite: false })
      .eq("id", id);
    if (error) {
      throw error;
    }
  },

  async deleteAnnouncement(id: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) {
      throw error;
    }
  }
};
