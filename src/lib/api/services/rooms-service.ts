import type { RoomsServiceInterface } from "./interfaces/rooms-service.interface";
import { isSupabase } from "./common";
import { sheetsRoomsService } from "./sheets/rooms-service";
import { supabaseRoomsService } from "./supabase/rooms-service";

export const roomsService: RoomsServiceInterface = isSupabase
  ? supabaseRoomsService
  : sheetsRoomsService;

export type { CurrRecord, AccountRow, AccountUpdate } from "./interfaces/rooms-service.interface";
