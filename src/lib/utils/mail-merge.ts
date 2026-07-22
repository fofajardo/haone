import { formatDate } from "$lib/utils/formatters";

/**
 * A simple mail merge engine for the Receipt Manager.
 * Supports:
 * - {{COLUMN_NAME}} for simple replacement
 * - {{TYPE|VALUE|CONTENT}} for conditional content
 */
export function mailMerge(template: string, data: Record<string, any>) {
  let result = template;

  // 1. Handle conditionals: {{KEY|EXPECTED_VALUE|CONTENT}}
  // This regex supports one level of nested {{...}} inside the CONTENT part.
  const conditionalRegex = /\{\{([^|}]+)\|([^|}]+)\|((?:[^{}]|\{\{[^{}]+\}\})+)\}\}/g;

  result = result.replace(conditionalRegex, (match, key, expectedValue, content) => {
    const actualValue = data[key.trim()];
    if (String(actualValue) === expectedValue.trim()) {
      return content;
    }
    return "";
  });

  // 2. Handle placeholders: {{COLUMN_NAME}}
  const placeholderRegex = /\{\{([^|}]+)\}\}/g;
  result = result.replace(placeholderRegex, (match, key) => {
    const trimmedKey = key.trim();
    let val = data[trimmedKey];

    // Auto-format dates
    if (trimmedKey.includes("DATE") && val) {
      return formatDate(val);
    }

    return val !== undefined ? val : match;
  });

  // 3. Clean up multiple newlines that might result from empty conditionals
  return result.replace(/\n{3,}/g, "\n\n").trim();
}
