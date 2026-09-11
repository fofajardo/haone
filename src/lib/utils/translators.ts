import collegeMapping from "$assets/colleges.json";
import programMapping from "$assets/programs.json";
import { ACCOUNT_TYPE_LABELS, PAYMENT_TYPE_CONFIG } from "$lib/types";

export function translateMop(mop: string) {
  const val = mop?.trim().toUpperCase() || "";
  if (val === "CASH") {
    return "CASH";
  }
  if (val === "GCASH") {
    return "G-XCHANGE/GCASH";
  }
  if (val === "MAYA") {
    return "MAYA PHILIPPINES, INC./MAYA WALLET";
  }
  if (val === "") {
    return "N/A";
  }
  return mop;
}

export function translatePeriod(period: string | null | undefined) {
  if (!period) {
    return "N/A";
  }
  const p = period.trim();
  const match = p.match(/^(\d{2})(\d{2})_(MY|[1-3]S)$/);
  if (!match) {
    return p;
  }
  const [_, year1, year2, term] = match;

  if (term === "MY") {
    return `AY 20${year1}-20${year2} Midyear Term`;
  }

  const sem = term.charAt(0);
  const ordinal = sem === "1" ? "1st" : "2nd";
  return `AY 20${year1}-20${year2} ${ordinal} Semester`;
}

export function translateCollege(college: string): string[] {
  if (!college) {
    return ["—"];
  }
  return college
    .split(",")
    .map((p) => p.trim())
    .map((p) => (collegeMapping as Record<string, string>)[p] || p);
}

export function translateProgram(program: string): string[] {
  if (!program) {
    return ["—"];
  }
  return program
    .split(":")
    .map((p) => p.trim())
    .map((p) => (programMapping as Record<string, string>)[p] || p);
}

export function translateAccountType(val: string | null | undefined): string {
  if (!val) {
    return "—";
  }
  const key = val.trim().toUpperCase() as keyof typeof ACCOUNT_TYPE_LABELS;
  return (ACCOUNT_TYPE_LABELS as Record<string, string>)[key] || val;
}

export function translatePaymentType(type: string | null | undefined): string {
  if (!type) {
    return "—";
  }
  const key = type.trim().toUpperCase() as keyof typeof PAYMENT_TYPE_CONFIG;
  return (
    (PAYMENT_TYPE_CONFIG as Record<string, { label: string }>)[key]?.label || `${type} (Unknown)`
  );
}
