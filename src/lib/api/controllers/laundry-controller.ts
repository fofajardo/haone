import type { LaundryRecord, PaginationOptions, PaginatedResponse } from "$lib/types";
import { parseTime } from "$utils/parsers";
import { laundryService } from "$api/services/laundry-service";
import { getCurrentResidentId } from "./resident-controller";

export interface ValidateLaundryOptions {
  date: string;
  timeStart: string;
  timeEnd: string;
  residentId?: string;
  isAdmin?: boolean;
  existingReservations?: LaundryRecord[];
}

export function validateLaundryReservation(options: ValidateLaundryOptions): string | null {
  try {
    const { date, timeStart, timeEnd, residentId, isAdmin = false, existingReservations = [] } = options;

    if (!date) {
      return "Please select a date";
    }
    if (!timeStart || !timeEnd) {
      return "Please provide times";
    }
    if (isAdmin && !residentId) {
      return "Please select a resident";
    }

    const startH = parseTime(timeStart);
    const endH = parseTime(timeEnd);
    if (isNaN(startH) || isNaN(endH)) {
      return "Invalid time format";
    }

    if (startH >= endH) {
      return "Start must be before end";
    }

    const duration = endH - startH;
    if (!isAdmin && duration > 2) {
      return "Max 2 hours allowed";
    }

    if (!isAdmin) {
      const [y, m, d] = date.split("-").map(Number);
      const selectedDateTime = new Date(y, m - 1, d, startH);
      const now = new Date();
      const isToday = y === now.getFullYear() && m === now.getMonth() + 1 && d === now.getDate();

      if (isToday) {
        if (startH < now.getHours()) {
          return "Cannot reserve for a past time";
        }
      } else if (selectedDateTime < now) {
        return "Cannot reserve for a past time";
      }

      const maxAdvance = new Date();
      maxAdvance.setDate(now.getDate() + 14);
      if (selectedDateTime > maxAdvance) {
        return "Max 2 weeks in advance";
      }
    }

    if (startH < 5 || endH > 22) {
      return isAdmin ? "Facility open 5 AM - 10 PM" : "Open 5 AM - 10 PM only";
    }

    const isOverlapping = existingReservations.some((r) => {
      if (r.status !== "ACTIVE" || r.date !== date) {
        return false;
      }
      const rStart = parseTime(r.timeStart);
      const rEnd = parseTime(r.timeEnd);
      return startH < rEnd && endH > rStart;
    });
    if (isOverlapping) {
      return "Overlaps with existing booking";
    }

    return null;
  } catch {
    return "Invalid reservation details";
  }
}

export async function fetchLaundryReservations(
  bypassCache = false
): Promise<{ reservations: LaundryRecord[]; currentResidentId: string }> {
  const currentResidentId = await getCurrentResidentId();
  const res = await laundryService.fetchReservations(currentResidentId, undefined, bypassCache);
  const list = Array.isArray(res) ? res : res.items;
  return {
    reservations: list,
    currentResidentId
  };
}

export async function addLaundryReservation(data: Omit<LaundryRecord, "raw">) {
  const { auth } = await import("$state/auth.svelte");
  const isAdmin = !auth.isResident;

  if (!isAdmin) {
    const { canAccessLaundry } = await import("./resident-controller");
    const { residentState } = await import("$state/resident-state.svelte");
    const accountType = residentState.status?.account?.type || residentState.status?.currEntry?.accountType || "";
    if (!canAccessLaundry(accountType)) {
      throw new Error("Access Denied: Account type cannot book laundry");
    }
  }

  const { date, timeStart, timeEnd } = data;
  if (!date || !timeStart || !timeEnd) {
    throw new Error("Date, Start Time, and End Time are required");
  }

  const startMinutes = parseTime(timeStart);
  const endMinutes = parseTime(timeEnd);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    throw new Error("Invalid time window specified");
  }

  if (!isAdmin && endMinutes - startMinutes > 120) {
    throw new Error("Reservations cannot exceed 2 hours");
  }

  const currentResidentId = data.residentId || (await getCurrentResidentId());
  const res = await laundryService.fetchReservations();
  const list = Array.isArray(res) ? res : res.items;
  const active = list.filter(
    (r) => r.status !== "CANCELLED_BY_ADMIN" && r.status !== "CANCELLED_BY_USER"
  );

  const sameSlotUser = active.find(
    (r) =>
      r.date === date &&
      r.timeStart === timeStart &&
      r.timeEnd === timeEnd &&
      r.residentId === currentResidentId
  );
  if (sameSlotUser) {
    throw new Error("You have already booked this exact slot");
  }

  return laundryService.addReservation({
    ...data,
    residentId: currentResidentId,
    status: "ACTIVE"
  });
}

export async function cancelLaundryReservation(
  reservationId: string,
  reason: string,
  _status: any = null
) {
  return await laundryService.cancelReservation(reservationId, reason || "Cancelled by resident");
}

export async function fetchAdminLaundryReservations(
  bypassCache = false,
  options?: PaginationOptions
): Promise<LaundryRecord[] | PaginatedResponse<LaundryRecord>> {
  return laundryService.fetchReservations(undefined, options, bypassCache);
}

export async function cancelAdminLaundryReservation(
  reservationId: string,
  reason: string,
  _status: any = null
) {
  await laundryService.cancelReservation(reservationId, reason || "Cancelled by admin");
}

export async function addLaundryReservationsBatch(entries: Partial<LaundryRecord>[]) {
  await laundryService.addReservationsBatch(entries);
}
