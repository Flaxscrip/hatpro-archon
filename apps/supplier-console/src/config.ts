// Runtime config for the supplier console. The supplier knows its own credential catalog
// and the friendly names of the schemas/issuers it deals with (from config/demo.json).

export interface DemoConfig {
  node: string;
  registry: string;
  schemas: { hatproProfile: string; over18: string; loyaltyTier: string };
  identities: Record<string, string>;
  groups: { admin: string; member: string };
  credentials: { over18: string; loyaltyTier: string };
}

export interface CatalogItem {
  key: string;
  label: string;
  schema: string;
  issuer: string;
  issuerLabel: string;
}

export interface AppConfig {
  resortApiUrl: string;
  registry: string;
  catalog: CatalogItem[];
  friendlyName: (did: string) => string;
}

export async function loadConfig(): Promise<AppConfig> {
  const res = await fetch('demo.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('demo.json not found — run `npm run provision` then restart the app');
  const demo: DemoConfig = await res.json();
  const resortApiUrl = (import.meta.env.VITE_RESORT_API_URL as string) || 'http://localhost:4326';

  const catalog: CatalogItem[] = [
    { key: 'over18', label: 'Over-18 Credential', schema: demo.schemas.over18, issuer: demo.identities['hatpro-gov'], issuerLabel: 'Gov ID Authority' },
    { key: 'loyalty', label: 'Loyalty Tier Credential', schema: demo.schemas.loyaltyTier, issuer: demo.identities['hatpro-loyalty'], issuerLabel: 'Seaside Rewards' },
    // No issuer constraint — the traveler's self-asserted HATPro profile (their unique data).
    { key: 'profile', label: 'HATPro Profile', schema: demo.schemas.hatproProfile, issuer: '', issuerLabel: 'self-asserted (any issuer)' },
  ];

  const names: Record<string, string> = {
    [demo.schemas.over18]: 'Over-18 Credential',
    [demo.schemas.loyaltyTier]: 'Loyalty Tier Credential',
    [demo.schemas.hatproProfile]: 'HATPro Profile',
    [demo.identities['hatpro-gov']]: 'Gov ID Authority',
    [demo.identities['hatpro-loyalty']]: 'Seaside Rewards',
    [demo.identities['hatpro-resort']]: 'Seaside Resort',
    [demo.identities['hatpro-registry']]: 'HATPro Trust Registry',
    [demo.identities['hatpro-avery']]: 'Avery (traveler)',
  };
  const friendlyName = (did: string) => names[did] || (did ? `${did.slice(0, 14)}…${did.slice(-6)}` : '');

  return { resortApiUrl, registry: demo.registry, catalog, friendlyName };
}
