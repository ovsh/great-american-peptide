// Lightweight ID generator. Not a UUID — short collision-resistant IDs are fine
// since records are local-only and namespaced by table.

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export function newId(prefix = ''): string {
  let id = '';
  for (let i = 0; i < 12; i++) {
    id += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return prefix ? `${prefix}_${id}` : id;
}
