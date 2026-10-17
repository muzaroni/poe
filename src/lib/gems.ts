// Keep canonical gem names in document data and lookup requests.
export function gemDisplayName(name: string): string {
  return name.replace(/\s+Support\b/gi, '');
}
