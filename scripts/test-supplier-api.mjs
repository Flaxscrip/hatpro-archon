#!/usr/bin/env node
/**
 * End-to-end test of the supplier backend over HTTP:
 *   resort-keymaster /profile-request  ->  traveler responds (avery wallet)  ->  /verify
 * Confirms the combined Archon-crypto + ToIP-trust verdict.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import Keymaster from '@didcid/keymaster';
import WalletJson from '@didcid/keymaster/wallet/json';
import CipherNode from '@didcid/cipher/node';
import DrawbridgeClient from '@didcid/gatekeeper/drawbridge';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const demo = JSON.parse(readFileSync(join(ROOT, 'config', 'demo.json'), 'utf-8'));
const RESORT_API = process.env.RESORT_API_URL || 'http://localhost:4326';
const REGISTRY = process.env.ARCHON_DEFAULT_REGISTRY || 'hyperswarm';
const PASSPHRASE = process.env.HATPRO_WALLET_PASSPHRASE || 'hatpro-demo-passphrase';
const GATEKEEPER_URL = process.env.ARCHON_GATEKEEPER_URL || 'http://flaxlap.local:4222';

const post = async (path, body) => (await fetch(`${RESORT_API}${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})).json();

// 1) Supplier composes the profile request (server-side, resort keys)
const { challenge } = await post('/profile-request', {
  credentials: [
    { schema: demo.schemas.over18, issuers: [demo.identities['hatpro-gov']] },
    { schema: demo.schemas.loyaltyTier, issuers: [demo.identities['hatpro-loyalty']] },
  ],
});
console.log('1. supplier profile-request ->', challenge);

// 2) Traveler consents + presents from their own wallet
const gatekeeper = new DrawbridgeClient();
await gatekeeper.connect({ url: GATEKEEPER_URL });
const avery = new Keymaster({ gatekeeper, wallet: new WalletJson('hatpro-avery.json', join(ROOT, 'wallets')), cipher: new CipherNode(), defaultRegistry: REGISTRY, passphrase: PASSPHRASE });
await avery.setCurrentId('hatpro-avery');
const response = await avery.createResponse(challenge, { registry: REGISTRY });
console.log('2. traveler response       ->', response);

// 3) Supplier verifies (crypto + ToIP trust)
const verdict = await post('/verify', { response });
console.log('3. supplier /verify verdict:');
console.log(JSON.stringify(verdict, null, 2));

const pass = verdict.cryptographicMatch && verdict.allIssuersTrusted && verdict.accepted;
console.log(`\n${pass ? '✓ SUPPLIER ACCEPTS' : '✗ NOT ACCEPTED'} (crypto + trust over HTTP)`);
process.exit(pass ? 0 : 1);
