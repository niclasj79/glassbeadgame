export function cloneAndFreeze<Value>(value: Value): Value {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => cloneAndFreeze(item))) as Value;
  }

  if (value !== null && typeof value === "object") {
    const clone: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      clone[key] = cloneAndFreeze(item);
    }
    return Object.freeze(clone) as Value;
  }

  return value;
}
