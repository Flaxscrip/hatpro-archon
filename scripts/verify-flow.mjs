#!/usr/bin/env node
/**
 * Verifies the full HATPro exchange ACROSS SEPARATE WALLETS using the identities
 * provisioned by provision.mjs. Loads each actor's own wallet file (no overwrite),
 * then runs: supplier request -> traveler consent/present -> supplier verify, plus
 * the trust-registry authorization checks (incl. a negative control).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import Keymaster from '@didcid/keymaster';
import WalletJson from '@didcid/keymaster/wallet/json';
import CipherNode from '@didcid/cipher/node';
import DrawbridgeClient from '@didcid/gatekeeper/drawbridge';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const WALLET_DIR = join(ROOT, 'wallets');

const GATEKEEPER_URL = process.env.ARCHON_GATEKEEPER_URL || 'http://flaxlap.local:4222';
const REGISTRY = process.env.ARCHON_DEFAULT_REGISTRY || 'hyperswarm';
const PASSPHRASE = process.env.HATPRO_WALLET_PASSPHRASE || 'hatpro-demo-passphrase';

const demo = JSON.parse(readFileSync(join(ROOT, 'config', 'demo.json'), 'utf-8'));

const gatekeeper = new DrawbridgeClient();
await gatekeeper.connect({ url: GATEKEEPER_URL });
const cipher = new CipherNode();

/** Open an already-provisioned wallet (load, do not overwrite) and select its id. */
async function loadActor(name) {
  const wallet = new WalletJson(`${name}.json`, WALLET_DIR);
  const km = new Keymaster({ gatekeeper, wallet, cipher, defaultRegistry: REGISTRY, passphrase: PASSPHRASE });
  await km.setCurrentId(name);
  return km;
}

const ok = (b) => (b ? 'PASS' : 'FAIL');
let allPass = true;
const expect = (label, cond) => { allPass = allPass && cond; console.log(`  [${ok(cond)}] ${label}`); };

const resort = await loadActor('hatpro-resort');
const avery = await loadActor('hatpro-avery');

// 1) Supplier issues a profile request (challenge) naming acceptable issuers
console.log('\n1. Supplier (resort wallet) creates profile request');
const challenge = await resort.createChallenge({
  credentials: [
    { schema: demo.schemas.over18, issuers: [demo.identities['hatpro-gov']] },
    { schema: demo.schemas.loyaltyTier, issuers: [demo.identities['hatpro-loyalty']] },
  ],
}, { registry: REGISTRY });
console.log(`   challenge: ${challenge}`);

// 2) Traveler consents and presents from their OWN wallet
console.log('\n2. Traveler (avery wallet) consents + presents');
const response = await avery.createResponse(challenge, { registry: REGISTRY });
console.log(`   response:  ${response}`);

// 3) Supplier verifies
console.log('\n3. Supplier (resort wallet) verifies presentation');
const result = await resort.verifyResponse(response);
expect(`requested == 2 (${result.requested})`, result.requested === 2);
expect(`fulfilled == 2 (${result.fulfilled})`, result.fulfilled === 2);
expect(`match == true`, result.match === true);
expect(`responder == avery`, result.responder === demo.identities['hatpro-avery']);

// 4) Trust-registry authorization (same group logic the TRQP server exposes)
console.log('\n4. Trust-registry authorization checks');
expect('gov authorized to issue (admin member)', await resort.testGroup(demo.groups.admin, demo.identities['hatpro-gov']));
expect('loyalty authorized to issue (admin member)', await resort.testGroup(demo.groups.admin, demo.identities['hatpro-loyalty']));
expect('resort authorized to verify (member group)', await resort.testGroup(demo.groups.member, demo.identities['hatpro-resort']));
expect('NEGATIVE: avery NOT an issuer', !(await resort.testGroup(demo.groups.admin, demo.identities['hatpro-avery'])));

console.log(`\n${allPass ? '✓ ALL CHECKS PASSED' : '✗ SOME CHECKS FAILED'} (cross-wallet)`);
process.exit(allPass ? 0 : 1);
