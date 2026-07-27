import type { RoomsServiceInterface } from "./interfaces/rooms-service.interface";
import { sheetsRoomsService } from "./sheets/rooms-service";
import { supabaseRoomsService } from "./supabase/rooms-service";
import { isSupabase } from "./common";

export const roomsService: RoomsServiceInterface = isSupabase
  ? supabaseRoomsService
  : sheetsRoomsService;
