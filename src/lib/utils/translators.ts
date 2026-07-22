import collegeMapping from "$data/colleges.json";
import programMapping from "$data/programs.json";

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

export function translateType(val: string, types: { value: string; label: string }[]) {
  const type = types.find((t) => t.value === val);
  return type ? type.label : val;
}
