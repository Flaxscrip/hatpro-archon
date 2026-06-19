#!/usr/bin/env node
/**
 * HATPro-on-Archon demo provisioner.
 *
 * Creates each actor in its OWN Archon wallet (separate WalletJson files), from
 * DETERMINISTIC BIP-39 seeds, so the whole demo is reproducible and resettable.
 * Schemas from Milestone 1 are reused by DID (see config/schemas.json).
 *
 * Actors / wallets:
 *   - hatpro-registry  : owns the trust-registry groups (admin = issuers, member = verifiers)
 *   - hatpro-gov       : trusted issuer (Over18 credential)
 *   - hatpro-loyalty   : trusted issuer (LoyaltyTier credential)
 *   - hatpro-resort    : supplier / verifier (consumed by supplier-console via keymaster API)
 *   - hatpro-avery     : traveler (also recoverable in the browser traveler-wallet from the same seed)
 *
 * Output: config/demo.json  (all resulting DIDs, consumed by the three apps)
 *
 * WARNING: the seeds below are PUBLIC, well-known BIP-39 test vectors. They make the
 * demo deterministic but provide ZERO security. Never use for anything but a local demo.
 */
import dotenv from 'dotenv';
dotenv.config({ override: true }); // repo .env is the source of truth, even over a pre-set shell var
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import Keymaster from '@didcid/keymaster';
import WalletJson from '@didcid/keymaster/wallet/json';
import CipherNode from '@didcid/cipher/node';
import DrawbridgeClient from '@didcid/gatekeeper/drawbridge';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const WALLET_DIR = join(ROOT, 'wallets');
const CONFIG_DIR = join(ROOT, 'config');

// --- env ---
const GATEKEEPER_URL = process.env.ARCHON_GATEKEEPER_URL || 'http://localhost:4222';
const REGISTRY = process.env.ARCHON_DEFAULT_REGISTRY || 'hyperswarm';
const PASSPHRASE = process.env.HATPRO_WALLET_PASSPHRASE || 'hatpro-demo-passphrase';

// Deterministic, PUBLIC demo seeds (standard BIP-39 test vectors).
const ACTORS = {
  'hatpro-registry': 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  'hatpro-gov':      'legal winner thank year wave sausage worth useful legal winner thank yellow',
  'hatpro-loyalty':  'letter advice cage absurd amount doctor acoustic avoid letter advice cage above',
  'hatpro-resort':   'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong',
  'hatpro-avery':    'ozone drill grab fiber curtain grace pudding thank cruise elder eight picnic',
};

const schemas = JSON.parse(readFileSync(join(CONFIG_DIR, 'schemas.json'), 'utf-8')).schemas;

const gatekeeper = new DrawbridgeClient();
await gatekeeper.connect({ url: GATEKEEPER_URL });
const cipher = new CipherNode();

/** Build a Keymaster bound to one actor's own wallet file, seeded deterministically. */
async function openActorWallet(name) {
  const wallet = new WalletJson(`${name}.json`, WALLET_DIR);
  const km = new Keymaster({ gatekeeper, wallet, cipher, defaultRegistry: REGISTRY, passphrase: PASSPHRASE });
  await km.newWallet(ACTORS[name], true); // overwrite from deterministic seed
  await km.recoverWallet();
  const did = await km.createId(name, { registry: REGISTRY });
  return { km, did };
}

async function main() {
  if (process.argv.includes('--reset') && existsSync(WALLET_DIR)) {
    rmSync(WALLET_DIR, { recursive: true, force: true });
    console.log('• reset: cleared wallets/');
  }
  mkdirSync(WALLET_DIR, { recursive: true });

  console.log(`• node:     ${GATEKEEPER_URL}`);
  console.log(`• registry: ${REGISTRY}\n`);

  // 1) One wallet + identity per actor
  const actor = {};
  for (const name of Object.keys(ACTORS)) {
    const { km, did } = await openActorWallet(name);
    actor[name] = { km, did };
    console.log(`✓ ${name.padEnd(16)} ${did}`);
  }

  // 2) Trust-registry groups (owned by the registry wallet)
  const reg = actor['hatpro-registry'].km;
  const adminGroup = await reg.createGroup('hatpro-admin', { registry: REGISTRY, alias: 'hatpro-admin' });
  const memberGroup = await reg.createGroup('hatpro-member', { registry: REGISTRY, alias: 'hatpro-member' });
  await reg.addGroupMember(adminGroup, actor['hatpro-gov'].did);
  await reg.addGroupMember(adminGroup, actor['hatpro-loyalty'].did);
  await reg.addGroupMember(memberGroup, actor['hatpro-resort'].did);
  console.log(`\n✓ admin group  ${adminGroup}  (gov, loyalty)`);
  console.log(`✓ member group ${memberGroup}  (resort)`);

  // 3) Issue credentials to the traveler, who then accepts them
  const averyDid = actor['hatpro-avery'].did;

  const gov = actor['hatpro-gov'].km;
  const over18Bound = await gov.bindCredential(averyDid, {
    schema: schemas.over18,
    claims: { over18: true, jurisdiction: 'US' },
  });
  const over18Vc = await gov.issueCredential(over18Bound, { registry: REGISTRY });

  const loyalty = actor['hatpro-loyalty'].km;
  const loyaltyBound = await loyalty.bindCredential(averyDid, {
    schema: schemas.loyaltyTier,
    claims: { program: 'Seaside Rewards', tier: 'gold', memberSince: '2021' },
  });
  const loyaltyVc = await loyalty.issueCredential(loyaltyBound, { registry: REGISTRY });

  const avery = actor['hatpro-avery'].km;
  await avery.acceptCredential(over18Vc);
  await avery.acceptCredential(loyaltyVc);
  console.log(`\n✓ over18 VC    ${over18Vc}  (gov → avery, accepted)`);
  console.log(`✓ loyalty VC   ${loyaltyVc}  (loyalty → avery, accepted)`);

  // Back up Avery to the registry so the browser traveler-wallet can recover the SAME
  // identity + held credentials from just the seed (recoverId), cross-impl (Node↔browser).
  await avery.backupId('hatpro-avery');
  console.log(`✓ avery backed up to registry (browser recoverId enabled)`);

  // 4) Persist the wired-up demo config for the apps
  const out = {
    generated: new Date().toISOString(),
    node: GATEKEEPER_URL,
    registry: REGISTRY,
    schemas,
    identities: Object.fromEntries(Object.entries(actor).map(([k, v]) => [k, v.did])),
    groups: { admin: adminGroup, member: memberGroup },
    credentials: { over18: over18Vc, loyaltyTier: loyaltyVc },
    seeds: ACTORS, // public demo seeds — included so apps (e.g. browser traveler-wallet) can recover the same identity
  };
  writeFileSync(join(CONFIG_DIR, 'demo.json'), JSON.stringify(out, null, 2));
  console.log(`\n✓ wrote config/demo.json`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('\n✗ provisioning failed:', err?.message || err);
  process.exit(1);
});
