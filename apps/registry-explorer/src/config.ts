// Runtime config for the trust-registry explorer. Pulls the known entities/schemas from
// config/demo.json so the query UI has friendly dropdowns; the registry is queried over HTTP.

export interface DemoConfig {
  node: string;
  registry: string;
  schemas: { hatproProfile: string; over18: string; loyaltyTier: string };
  identities: Record<string, string>;
  groups: { admin: string; member: string };
}

export interface Entity { label: string; did: string }

export interface AppConfig {
  registryUrl: string;
  authorityDid: string;
  entities: Entity[];
  actions: string[];
  resources: Entity[];
  friendlyName: (did: string) => string;
}

export async function loadConfig(): Promise<AppConfig> {
  const res = await fetch('demo.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('demo.json not found — run `npm run provision` then restart the app');
  const demo: DemoConfig = await res.json();
  const registryUrl = (import.meta.env.VITE_TRUST_REGISTRY_URL as string) || 'http://localhost:4260';

  const entities: Entity[] = [
    { label: 'Gov ID Authority', did: demo.identities['hatpro-gov'] },
    { label: 'Seaside Rewards', did: demo.identities['hatpro-loyalty'] },
    { label: 'Seaside Resort', did: demo.identities['hatpro-resort'] },
    { label: 'Avery (traveler)', did: demo.identities['hatpro-avery'] },
  ];
  const resources: Entity[] = [
    { label: 'Over-18 Credential', did: demo.schemas.over18 },
    { label: 'Loyalty Tier Credential', did: demo.schemas.loyaltyTier },
    { label: 'HATPro Profile', did: demo.schemas.hatproProfile },
  ];

  const names: Record<string, string> = {
    [demo.identities['hatpro-registry']]: 'HATPro Trust Registry',
    ...Object.fromEntries(entities.map((e) => [e.did, e.label])),
    ...Object.fromEntries(resources.map((r) => [r.did, r.label])),
  };
  const friendlyName = (did: string) => names[did] || (did ? `${did.slice(0, 14)}…${did.slice(-6)}` : '');

  return {
    registryUrl,
    authorityDid: demo.identities['hatpro-registry'],
    entities,
    actions: ['issue', 'verify', 'hold', 'present', 'revoke'],
    resources,
    friendlyName,
  };
}
