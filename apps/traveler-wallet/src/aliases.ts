// The traveler's address book: human-friendly aliases for known organizations (DIDs)
// and VC schemas, backed by keymaster's built-in name registry (addAlias/listAliases).
import type Keymaster from '@didcid/keymaster';
import { AppConfig } from './config';

export type AliasType = 'Organization' | 'Schema' | 'DID';
export interface AliasEntry { alias: string; did: string; type: AliasType }

/** Friendly starter aliases derived from the demo actors/schemas. */
export function defaultAliasSeeds(cfg: AppConfig): { alias: string; did: string }[] {
  return [
    { alias: 'Gov ID Authority', did: cfg.identities['hatpro-gov'] },
    { alias: 'Seaside Rewards', did: cfg.identities['hatpro-loyalty'] },
    { alias: 'Seaside Resort', did: cfg.identities['hatpro-resort'] },
    { alias: 'HATPro Trust Registry', did: cfg.identities['hatpro-registry'] },
    { alias: 'Over-18 Credential', did: cfg.schemas.over18 },
    { alias: 'Loyalty Tier Credential', did: cfg.schemas.loyaltyTier },
    { alias: 'HATPro Profile', did: cfg.schemas.hatproProfile },
  ].filter((s) => !!s.did);
}

export function classify(did: string, cfg: AppConfig): AliasType {
  if (Object.values(cfg.schemas).includes(did)) return 'Schema';
  if (Object.values(cfg.identities).includes(did)) return 'Organization';
  return 'DID';
}

/** Idempotently add the starter aliases (skips DIDs/names already present). */
export async function seedAliases(km: Keymaster, cfg: AppConfig): Promise<void> {
  const existing = await km.listAliases().catch(() => ({} as Record<string, string>));
  const usedDids = new Set(Object.values(existing));
  const usedNames = new Set(Object.keys(existing));
  for (const { alias, did } of defaultAliasSeeds(cfg)) {
    if (usedDids.has(did) || usedNames.has(alias)) continue;
    try { await km.addAlias(alias, did); usedDids.add(did); usedNames.add(alias); } catch { /* already used */ }
  }
}

export async function loadAliases(km: Keymaster, cfg: AppConfig) {
  const map = await km.listAliases().catch(() => ({} as Record<string, string>));
  const list: AliasEntry[] = Object.entries(map)
    .map(([alias, did]) => ({ alias, did, type: classify(did, cfg) }))
    .sort((a, b) => a.type.localeCompare(b.type) || a.alias.localeCompare(b.alias));
  const byDid: Record<string, string> = {};
  for (const [alias, did] of Object.entries(map)) byDid[did] = alias;
  return { list, byDid };
}
