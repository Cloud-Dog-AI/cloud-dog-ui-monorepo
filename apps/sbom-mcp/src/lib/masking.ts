// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

const SECRET_KEY = /(password|secret|token|credential|api[_-]?key|access[_-]?key|(^|[_-])key($|[_-]))/i;
const BACKEND_REDACTION = /\*\*\*\s*REDACTED\b.*\*\*\*/i;

export function normaliseMaskedValue(key: string, value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    if (BACKEND_REDACTION.test(value) || (SECRET_KEY.test(key) && value.length > 0)) {
      return "<redacted>";
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => normaliseMaskedValue(String(index), item));
  }
  if (typeof value === "object") {
    return normaliseMaskedSettings(value as Record<string, unknown>);
  }
  return value;
}

export function normaliseMaskedSettings(node: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => [key, normaliseMaskedValue(key, value)])
  );
}

export function removeRedactedValues(node: unknown): unknown {
  if (Array.isArray(node)) return node.map((item) => removeRedactedValues(item));
  if (!node || typeof node !== "object") return node;
  return Object.fromEntries(
    Object.entries(node as Record<string, unknown>)
      .filter(([, value]) => value !== "<redacted>")
      .map(([key, value]) => [key, removeRedactedValues(value)])
  );
}

export function flattenSettings(
  node: Record<string, unknown>,
  prefix = "",
): Array<{ path: string; value: unknown; masked: boolean }> {
  const rows: Array<{ path: string; value: unknown; masked: boolean }> = [];
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      rows.push(...flattenSettings(value as Record<string, unknown>, path));
    } else {
      rows.push({ path, value, masked: value === "<redacted>" });
    }
  }
  return rows;
}
