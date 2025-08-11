// Utility helpers for model key construction & parsing
// Centralizes the `${providerId}::${modelId}` convention to avoid magic strings.

export function buildModelKey(providerId: string, modelId: string): string {
  return `${providerId}::${modelId}`;
}

export function parseModelKey(key: string): { providerId: string; modelId: string } | null {
  if (!key) return null;
  const parts = key.split('::');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { providerId: parts[0], modelId: parts[1] };
}

export function isModelKey(key: string): boolean {
  return parseModelKey(key) !== null;
}
