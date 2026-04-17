export function formatCurrency(amount: number) {
  return amount.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP"
  });
}

export function formatAmount(amount: number) {
  return amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatAccounting(amount: number) {
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

export function translatePeriod(period: string) {
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
