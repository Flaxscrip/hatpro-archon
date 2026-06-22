// Builds links to the standalone DID resolver page (public/resolver.html), passing the
// gatekeeper URL so it resolves against the same node the wallet uses. The href is relative
// to the current page so it works at both `/` (dev) and `/traveler/` (production).
let gatekeeper = '';

export function setGatekeeper(url: string): void { gatekeeper = url; }

export function resolverHref(did: string): string {
  return `resolver.html?did=${encodeURIComponent(did)}&gk=${encodeURIComponent(gatekeeper)}`;
}
