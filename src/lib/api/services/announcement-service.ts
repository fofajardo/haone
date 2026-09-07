import { isSupabase } from "./common";
import type { AnnouncementServiceInterface } from "./interfaces/announcement-service.interface";
import { sheetsAnnouncementService } from "./sheets/announcement-service";
import { supabaseAnnouncementService } from "./supabase/announcement-service";

export const announcementService: AnnouncementServiceInterface = isSupabase
  ? supabaseAnnouncementService
  : sheetsAnnouncementService;

export * from "./interfaces/announcement-service.interface";
