import roomsData from "$srcPrivate/rooms.json";

export interface RoomEntry {
  room_number: string;
  slots: string[];
  available_slots: string[];
  unavailable_reason: string | null;
}

export interface RoomUnit {
  id: string;
  name: string;
  rooms: RoomEntry[];
}

export interface RoomsProfile {
  unit_chars: number;
  units: RoomUnit[];
}

function getProfile(profile: string): RoomsProfile {
  const data = roomsData as Record<string, RoomsProfile>;
  return data[profile] ?? data["default"];
}

/** Flat list of all rooms across all units — backward-compatible. */
export function getAllRooms(profile: string): RoomEntry[] {
  return getProfile(profile).units.flatMap((u) => u.rooms);
}

/** All units for a profile. */
export function getUnits(profile: string): RoomUnit[] {
  return getProfile(profile).units;
}

/** Unit that contains the given room number, or null. */
export function getUnitForRoom(room: string, profile: string): RoomUnit | null {
  const prefix = room.charAt(0).toUpperCase();
  return getProfile(profile).units.find((u) => u.id === prefix) ?? null;
}
