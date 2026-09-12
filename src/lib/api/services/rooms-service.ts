import { isSupabase } from "./common";
import type { RoomsServiceInterface } from "./interfaces/rooms-service.interface";
import { sheetsRoomsService } from "./sheets/rooms-service";
import { supabaseRoomsService } from "./supabase/rooms-service";

export const roomsService: RoomsServiceInterface = isSupabase
  ? supabaseRoomsService
  : sheetsRoomsService;

export type { AccountRow, AccountUpdate, CurrRecord } from "./interfaces/rooms-service.interface";
