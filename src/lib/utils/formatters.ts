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

export function formatDate(dateStr: string) {
  if (!dateStr) {
    return "N/A";
  }
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr;
    }
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  } catch (e) {
    return dateStr;
  }
}

export function formatTime(hour: number): string {
  const h = hour % 12 || 12;
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${h}:00 ${ampm}`;
}

export function pluralize(count: number, singular: string, plural: string) {
  const pr = new Intl.PluralRules("en-PH");
  const type = pr.select(count);
  const word = type === "one" ? singular : plural;
  return `${count} ${word}`;
}
