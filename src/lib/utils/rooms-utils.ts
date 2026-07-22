import roomsData from "$data/rooms.json";

export interface RoomNetworkConfig {
  subnet: string;
  gateway: string;
  dns_primary: string;
  dns_secondary: string;
}

export interface RoomEntry {
  room_number: string;
  slots: string[];
  available_slots: string[];
  unavailable_reason: string | null;
}

export interface RoomUnit {
  id: string;
  name: string;
  static_ip_enabled: boolean;
  network: RoomNetworkConfig;
  reserved_ips: string[];
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

/** Network config for the unit that contains the given room, or null. */
export function getNetworkConfig(room: string, profile: string): RoomNetworkConfig | null {
  const unit = getUnitForRoom(room, profile);
  if (!unit) {
    return null;
  }
  return unit.network;
}

/** Whether static IP is enabled for the unit of the given room. */
export function isStaticIpEnabled(room: string, profile: string): boolean {
  const unit = getUnitForRoom(room, profile);
  if (!unit) {
    return false;
  }
  return unit.static_ip_enabled;
}

/** Reserved IPs for the unit of the given room. */
export function getReservedIps(room: string, profile: string): string[] {
  const unit = getUnitForRoom(room, profile);
  if (!unit) {
    return [];
  }
  return unit.reserved_ips;
}

/** All reserved IPs across all units (for cross-unit conflict checking). */
export function getAllReservedIps(profile: string): string[] {
  return [...new Set(getProfile(profile).units.flatMap((u) => u.reserved_ips))];
}
