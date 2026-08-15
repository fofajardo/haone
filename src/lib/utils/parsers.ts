export function parseRef(ref: string) {
  if (!ref) {
    return { reference: "N/A", invoice: null };
  }
  const parts = ref.split(";").map((p) => p.trim());
  return {
    reference: parts[0] || "N/A",
    invoice: parts[1] || null
  };
}

export function parseDateWeight(dateStr: any): number {
  if (!dateStr) {
    return 0;
  }
  let weight = 0;
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      weight = d.getTime();
    } else {
      // Fallback for M/D/YYYY or D/M/YYYY
      const str = String(dateStr).trim();
      const parts = str.split(/[\/\-]/);
      if (parts.length === 3) {
        // Assume M/D/YYYY (common in sheets)
        const m = parseInt(parts[0]);
        const day = parseInt(parts[1]);
        let y = parseInt(parts[2]);
        if (y < 100) {
          y += 2000;
        }
        const date = new Date(y, m - 1, day);
        if (!isNaN(date.getTime())) {
          weight = date.getTime();
        }
      }
    }
  } catch (e) {}
  return weight;
}

export function parseTime(timeStr: string): number {
  if (!timeStr) {
    return 0;
  }
  const str = timeStr.trim().toUpperCase();
  if (str === "24:00" || str === "24") {
    return 24;
  }
  const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!match) {
    return parseInt(str.split(":")[0]) || 0;
  }

  const hours = parseInt(match[1]);
  const minutes = parseInt(match[2]) || 0;
  const ampm = match[3];

  let h = hours;
  if (ampm === "PM" && h < 12) {
    h += 12;
  }
  if (ampm === "AM" && h === 12) {
    h = 0;
  }
  return h + minutes / 60;
}

export function parseTimeMinutes(timeStr: string): number {
  if (!timeStr) {
    return 0;
  }
  const str = timeStr.trim().toUpperCase();
  if (str === "24:00" || str === "24") {
    return 1440;
  }
  const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!match) {
    const parts = str.split(":");
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    return h * 60 + m;
  }

  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]) || 0;
  const ampm = match[3];

  if (ampm === "PM" && hours < 12) {
    hours += 12;
  }
  if (ampm === "AM" && hours === 12) {
    hours = 0;
  }
  return hours * 60 + minutes;
}

export function getJournalDateRange(journal: { date: string }[]): { start: string; end: string } {
  const sortedDates = journal
    .map((j) => j.date)
    .filter(Boolean)
    .sort((a, b) => parseDateWeight(a) - parseDateWeight(b));

  if (sortedDates.length > 0) {
    return {
      start: sortedDates[0],
      end: sortedDates[sortedDates.length - 1]
    };
  }
  return { start: "", end: "" };
}

/**
 * Returns today's date as YYYY-MM-DD in LOCAL time (toISOString would be UTC,
 * which is off by a day for UTC+8 mornings).
 */
export function getLocalDateString(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(val: string | null | undefined): boolean {
  if (!val) {
    return false;
  }
  return UUID_REGEX.test(val);
}

export function parseDbDate(val: any): string | null {
  if (!val) {
    return null;
  }
  const str = String(val).trim();
  if (!str || str.toUpperCase() === "FIXME" || str.toUpperCase() === "N/A") {
    return null;
  }
  const date = new Date(str);
  if (isNaN(date.getTime())) {
    return null;
  }
  return str;
}

export function parseDbUuid(val: any): string | null {
  if (!val) {
    return null;
  }
  const str = String(val).trim();
  if (!str || !isUuid(str)) {
    return null;
  }
  return str;
}
