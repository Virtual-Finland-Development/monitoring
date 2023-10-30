export function ensurePrefix(prefix: string, str: string): string {
  if (str.startsWith(prefix)) {
    return str;
  }
  return prefix + str;
}
