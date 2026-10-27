// Analytics identifiers are pseudonymous labels, never authentication credentials.
// getRandomValues remains available on HTTP intranet pages where randomUUID is absent.
export function analyticsId(cryptoApi = globalThis.crypto) {
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}
