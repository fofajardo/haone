export function formatCurrency(amount: number) {
  if (amount === undefined || amount === null || isNaN(amount)) {
    console.warn("formatCurrency: invalid amount");
    return "₱0.00";
  }
  return amount.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP"
  });
}

export function formatAmount(amount: number) {
  if (amount === undefined || amount === null || isNaN(amount)) {
    console.warn("formatAmount: invalid amount");
    return "0.00";
  }
  return amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatAccounting(amount: number) {
  if (amount === undefined || amount === null || isNaN(amount)) {
    console.warn("formatAccounting: invalid amount");
    return "0.00";
  }
  const rounded = Math.round(amount * 100) / 100;
  const abs = Math.abs(rounded);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return rounded < 0 ? `(${formatted})` : formatted;
}

export function calculateTotal(items: { amount: number }[]) {
  if (!items) return 0;
  return items.reduce((sum, item) => sum + item.amount, 0);
}

export function translateMop(mop: string) {
  const val = mop?.trim().toUpperCase() || "";
  if (val === "CASH") return "CASH";
  if (val === "GCASH") return "G-XCHANGE/GCASH";
  if (val === "MAYA") return "MAYA PHILIPPINES, INC./MAYA WALLET";
  if (val === "") return "N/A";
  return mop;
}

export function translatePeriod(period: string | null | undefined) {
  if (!period) return "N/A";
  const p = period.trim();
  const match = p.match(/^(\d{2})(\d{2})_(MY|[1-3]S)$/);
  if (!match) return p;
  const [_, year1, year2, term] = match;

  if (term === "MY") {
    return `AY 20${year1}-20${year2} Midyear Term`;
  }

  const sem = term.charAt(0);
  const ordinal = sem === "1" ? "1st" : "2nd";
  return `AY 20${year1}-20${year2} ${ordinal} Semester`;
}

export function parseRef(ref: string) {
  if (!ref) return { reference: "N/A", invoice: null };
  const parts = ref.split(";").map((p) => p.trim());
  return {
    reference: parts[0] || "N/A",
    invoice: parts[1] || null
  };
}

export function formatDate(dateStr: string) {
  if (!dateStr) return "N/A";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  } catch (e) {
    return dateStr;
  }
}

export function parseDateWeight(dateStr: any): number {
  if (!dateStr) return 0;
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
        if (y < 100) y += 2000;
        const date = new Date(y, m - 1, day);
        if (!isNaN(date.getTime())) weight = date.getTime();
      }
    }
  } catch (e) {}
  return weight;
}

import collegeMapping from "./colleges.json";
import programMapping from "./programs.json";

export function translateCollege(college: string): string[] {
  if (!college) return ["—"];
  return college
    .split(",")
    .map((p) => p.trim())
    .map((p) => (collegeMapping as Record<string, string>)[p] || p);
}

export function translateProgram(program: string): string[] {
  if (!program) return ["—"];
  return program
    .split(":")
    .map((p) => p.trim())
    .map((p) => (programMapping as Record<string, string>)[p] || p);
}

export function parseCSVAmount(val: any): number {
  if (val === undefined || val === null) return 0;
  const str = String(val).trim().replace(/[₱,]/g, "").replace(/,/g, "");
  if (!str) {
    return 0;
  }

  // Check for (1,234.56) accounting format
  const isNegative = (str.startsWith("(") && str.endsWith(")")) || str.startsWith("-");
  const numericStr = isNegative ? (str.startsWith("-") ? str.slice(1) : str.slice(1, -1)) : str;

  const parsed = parseFloat(numericStr);
  if (isNaN(parsed)) {
    return 0;
  }

  return isNegative ? -parsed : parsed;
}

export function pluralize(count: number, singular: string, plural: string) {
  const pr = new Intl.PluralRules("en-PH");
  const type = pr.select(count);
  const word = type === "one" ? singular : plural;
  return `${count} ${word}`;
}

export function translateType(val: string, types: { value: string; label: string }[]) {
  const type = types.find((t) => t.value === val);
  return type ? type.label : val;
}

export function sortPeriods(periods: string[]) {
  const getWeight = (term: string) => {
    if (term === "MY") return 3;
    if (term === "2S") return 2;
    if (term === "1S") return 1;
    return 0;
  };

  return [...periods].sort((a, b) => {
    const matchA = a.match(/^(\d{2})(\d{2})_(MY|[1-3]S)$/);
    const matchB = b.match(/^(\d{2})(\d{2})_(MY|[1-3]S)$/);

    if (!matchA || !matchB) return a.localeCompare(b);

    const yearA = parseInt(matchA[1]);
    const yearB = parseInt(matchB[1]);
    const termA = matchA[3];
    const termB = matchB[3];

    if (yearA !== yearB) return yearB - yearA;
    return getWeight(termB) - getWeight(termA);
  });
}

export function parseTime(timeStr: string): number {
  if (!timeStr) return 0;
  const str = timeStr.trim().toUpperCase();
  const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!match) {
    return parseInt(str.split(":")[0]) || 0;
  }

  const hours = parseInt(match[1]);
  const ampm = match[3];

  let h = hours;
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return h;
}

export function formatTime(hour: number): string {
  const h = hour % 12 || 12;
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${h}:00 ${ampm}`;
}

export function getJournalDateRange(journal: { date: string }[]): { start: string; end: string } {
  const sortedDates = journal
    .map((j) => {
      return j.date;
    })
    .filter(Boolean)
    .sort((a, b) => {
      return parseDateWeight(a) - parseDateWeight(b);
    });

  if (sortedDates.length > 0) {
    return {
      start: sortedDates[0],
      end: sortedDates[sortedDates.length - 1]
    };
  }
  return { start: "", end: "" };
}
