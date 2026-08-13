import type { LaundryRecord, PaginationOptions, PaginatedResponse } from "$lib/types";
import { parseTime } from "$utils/parsers";
import { laundryService } from "$api/services/laundry-service";
import { getCurrentResidentId } from "./resident-controller";

export async function fetchLaundryReservations(
  forceRefresh = false
): Promise<{ reservations: LaundryRecord[]; currentResidentId: string }> {
  const currentResidentId = await getCurrentResidentId();
  const res = await laundryService.fetchReservations(currentResidentId, undefined, forceRefresh);
  const list = Array.isArray(res) ? res : res.items;
  return {
    reservations: list,
    currentResidentId
  };
}

export async function addLaundryReservation(data: Omit<LaundryRecord, "raw">) {
  const { canAccessLaundry } = await import("./resident-controller");
  const accountType = "STUDENT";
  if (!canAccessLaundry(accountType)) {
    throw new Error("Access Denied: Account type cannot book laundry");
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
  if (endMinutes - startMinutes > 180) {
    throw new Error("Reservations cannot exceed 3 hours");
  }

  const currentResidentId = data.residentId || (await getCurrentResidentId());
  const res = await laundryService.fetchReservations();
  const list = Array.isArray(res) ? res : res.items;
  const active = list.filter(
    (r) => r.status !== "CANCELLED_BY_ADMIN" && r.status !== "CANCELLED_BY_USER"
  );

  const userActiveCount = active.filter((r) => r.residentId === currentResidentId).length;
  if (userActiveCount >= 2) {
    throw new Error("You already have 2 active laundry reservations");
  }

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
  forceRefresh = false,
  options?: PaginationOptions
): Promise<LaundryRecord[] | PaginatedResponse<LaundryRecord>> {
  return laundryService.fetchReservations(undefined, options, forceRefresh);
}

export async function addAdminLaundryReservation(data: Omit<LaundryRecord, "raw">) {
  const startH = parseTime(data.timeStart);
  const endH = parseTime(data.timeEnd);
  const [y, m, d] = data.date.split("-").map(Number);
  const start = new Date(y, m - 1, d, startH || 0);
  const end = new Date(y, m - 1, d, endH || 0);

  if (start >= end) {
    throw new Error("Start time must be before end time.");
  }

  const opStart = 5;
  const opEnd = 22;
  if (
    start.getHours() < opStart ||
    end.getHours() > opEnd ||
    (end.getHours() === opEnd && end.getMinutes() > 0)
  ) {
    throw new Error("Laundry facility is only open from 5:00 AM to 10:00 PM.");
  }

  const durationMs = end.getTime() - start.getTime();
  if (durationMs > 2 * 60 * 60 * 1000) {
    throw new Error("Maximum of two (2) hours for any reservation.");
  }

  const existingResult = await fetchAdminLaundryReservations(true);
  const existing = Array.isArray(existingResult) ? existingResult : existingResult.items;

  const isOverlapping = existing.some((r) => {
    if (r.date !== data.date) {
      return false;
    }
    if (
      r.status === "CANCELLED" ||
      r.status === "CANCELLED_BY_ADMIN" ||
      r.status === "CANCELLED_BY_USER"
    ) {
      return false;
    }
    const rStartH = parseTime(r.timeStart);
    const rEndH = parseTime(r.timeEnd);
    const rStart = new Date(y, m - 1, d, rStartH || 0);
    const rEnd = new Date(y, m - 1, d, rEndH || 0);
    return start < rEnd && end > rStart;
  });

  if (isOverlapping) {
    throw new Error("Selected time slot overlaps with an existing active reservation.");
  }

  await laundryService.addReservation({
    ...data,
    status: "ACTIVE"
  });
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
