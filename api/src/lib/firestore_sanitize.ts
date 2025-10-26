import { FieldValue } from "firebase-admin/firestore";

/**
 * Recursively strips `undefined` values from objects and arrays so Firestore accepts the payload.
 * Keeps sentinel values like FieldValue instances intact.
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined);
    return cleaned as typeof value;
  }

  if (value && typeof value === "object") {
    // Preserve Firestore sentinels and other special objects
    if (
      value instanceof Date ||
      value instanceof Buffer ||
      value instanceof FieldValue
    ) {
      return value;
    }

    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, stripUndefinedDeep(v)]);

    return Object.fromEntries(entries) as T;
  }

  return value;
}
