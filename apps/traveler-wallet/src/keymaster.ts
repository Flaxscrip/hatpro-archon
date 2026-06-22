// In-process keymaster for the browser traveler-wallet (self-custody).
// Mirrors ~/archon/apps/react-wallet: DrawbridgeClient + WalletWeb + CipherWeb.
// Each visitor creates their OWN identity, stored only in this browser (WalletWeb ->
// localStorage). The node is used solely as the public gatekeeper for DID resolution.
import DrawbridgeClient from '@didcid/gatekeeper/drawbridge';
import Keymaster from '@didcid/keymaster';
import CipherWeb from '@didcid/cipher';
import WalletWeb from '@didcid/keymaster/wallet/web';
import { AppConfig, WALLET_PASSPHRASE } from './config';
import { seedAliases } from './aliases';

export interface Identity { name: string; did: string }
export interface OnboardResult { identity: Identity; verifiedIssued: boolean }

/** Wipe this browser's wallet and reload — a clean slate for the next demo participant. */
export function resetWallet(): void {
  localStorage.clear();
  location.reload();
}

/** Build the keymaster bound to this browser's wallet, creating an empty wallet on first run. */
export async function buildKeymaster(cfg: AppConfig): Promise<Keymaster> {
  const gatekeeper = new DrawbridgeClient();
  await gatekeeper.connect({ url: cfg.gatekeeperUrl });
  const cipher = new CipherWeb();
  const wallet = new WalletWeb();
  const keymaster = new Keymaster({ gatekeeper, wallet, cipher, passphrase: WALLET_PASSPHRASE });

  // Ensure a wallet (random seed) exists so createId works; preserve any existing wallet.
  try { await keymaster.listIds(); } catch { await keymaster.newWallet(undefined, true); }
  await seedAliases(keymaster, cfg);
  return keymaster;
}

/** The traveler's current identity, or null if they haven't created one yet. */
export async function currentIdentity(km: Keymaster): Promise<Identity | null> {
  try {
    const name = await km.getCurrentId();
    if (!name) return null;
    const doc = await km.resolveDID(name);
    return { name, did: (doc as any).didDocument.id };
  } catch { return null; }
}

/**
 * Create a brand-new traveler identity in this browser, then auto-receive the verified
 * starter credentials (Over-18, Loyalty) from the issuer service and accept them.
 */
export async function createTraveler(km: Keymaster, cfg: AppConfig, name: string): Promise<OnboardResult> {
  const did = await km.createId(name, { registry: cfg.registry });
  await km.setCurrentId(name);

  // Auto-issue verified credentials to the new identity (server-side trusted issuers).
  // verifiedIssued=false means the issuer was unreachable — surface it so the operator knows
  // the traveler won't have verified VCs (they can still self-assert a profile).
  let verifiedIssued = false;
  try {
    const res = await fetch(`${cfg.issuerApiUrl}/onboard`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ did }),
    });
    const vcs = await res.json();
    if (res.ok && (vcs.over18 || vcs.loyaltyTier)) {
      for (const vc of [vcs.over18, vcs.loyaltyTier]) if (vc) await km.acceptCredential(vc);
      verifiedIssued = true;
    }
  } catch { /* issuer offline */ }

  return { identity: { name, did }, verifiedIssued };
}

/** Schema DIDs of the credentials the current identity holds (for "do I have what's requested?"). */
export async function heldSchemas(km: Keymaster): Promise<Set<string>> {
  const dids: string[] = await km.listCredentials().catch(() => []);
  const vcs = await Promise.all(dids.map((d) => km.getCredential(d).catch(() => null)));
  return new Set(vcs.map((vc) => vc?.credentialSchema?.id).filter(Boolean) as string[]);
}

/**
 * Self-issue the traveler's HATPro profile as a VC (provenance: self-asserted) so it can be
 * presented to a supplier. Removes any prior profile VC first so only the latest is held.
 */
export async function saveProfileCredential(km: Keymaster, cfg: AppConfig, did: string, profile: unknown): Promise<string> {
  const held: string[] = await km.listCredentials();
  for (const vcDid of held) {
    const vc = await km.getCredential(vcDid).catch(() => null);
    if (vc?.credentialSchema?.id === cfg.schemas.hatproProfile) await km.removeCredential(vcDid);
  }
  const bound = await km.bindCredential(did, { schema: cfg.schemas.hatproProfile, claims: profile as Record<string, unknown> });
  const vcDid = await km.issueCredential(bound, { registry: cfg.registry });
  await km.acceptCredential(vcDid);
  return vcDid;
}
