import roomsData from "$srcPrivate/rooms.json";
import { brandingState } from "$state/branding.svelte";
import { getAllRooms } from "$utils/rooms-utils";

export interface RoomSlot {
  room_number: string;
  slot: string;
}

export interface RoomConfig {
  room_number: string;
  slots: string[];
  available_slots: string[];
  unavailable_reason: string | null;
}

class RoomsState {
  get unitChars(): number {
    const key = brandingState.selectedKey;
    // @ts-ignore
    return (roomsData[key] || roomsData["default"]).unit_chars || 0;
  }

  getUnit(roomNumber: string): string {
    if (!roomNumber) {
      return "N/A";
    }
    const chars = this.unitChars;
    return roomNumber.substring(0, chars).toUpperCase();
  }

  get config(): RoomConfig[] {
    const key = brandingState.selectedKey;
    return getAllRooms(key);
  }

  get allSlots(): RoomSlot[] {
    const slots: RoomSlot[] = [];
    for (const room of this.config) {
      for (const slot of room.slots) {
        slots.push({
          room_number: room.room_number,
          slot
        });
      }
    }
    return slots;
  }

  isAvailable(roomNumber: string, slot: string): boolean {
    const room = this.config.find((r) => r.room_number === roomNumber);
    if (!room) {
      return false;
    }
    if (room.unavailable_reason) {
      return false;
    }
    return room.available_slots.includes(slot);
  }
}

export const roomsState = new RoomsState();
