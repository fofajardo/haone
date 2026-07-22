export function calculateTotal(items: { amount: number }[]) {
  if (!items) {
    return 0;
  }
  return items.reduce((sum, item) => sum + item.amount, 0);
}

export function parseCSVAmount(val: any): number {
  if (val === undefined || val === null) {
    return 0;
  }
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
