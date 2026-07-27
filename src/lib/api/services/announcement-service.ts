import { isSupabase } from "./common";
import { sheetsAnnouncementService } from "./sheets/announcement-service";
import { supabaseAnnouncementService } from "./supabase/announcement-service";
import type { AnnouncementServiceInterface } from "./interfaces/announcement-service.interface";

export const announcementService: AnnouncementServiceInterface = isSupabase
  ? supabaseAnnouncementService
  : sheetsAnnouncementService;

export * from "./interfaces/announcement-service.interface";
