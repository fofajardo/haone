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

export function calculateTotal(items: { amount: number }[]) {
  if (!items) return 0;
  return items.reduce((sum, item) => sum + item.amount, 0);
}

export function translateMop(mop: string) {
  const val = mop?.trim().toUpperCase() || "";
  if (val === "CASH") return "N/A (CASH)";
  if (val === "GCASH") return "G-XCHANGE/GCASH";
  if (val === "MAYA") return "MAYA PHILIPPINES, INC./MAYA WALLET";
  if (val === "") return "N/A";
  return mop;
}

export function translatePeriod(period: string) {
  if (!period) return "N/A";
  const p = period.trim();
  const match = p.match(/^(\d{2})(\d{2})_(\d)S$/);
  if (!match) return p;
  const [_, year1, year2, sem] = match;
  const ordinal = sem === "1" ? "1st" : sem === "2" ? "2nd" : sem === "3" ? "3rd" : `${sem}th`;
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
