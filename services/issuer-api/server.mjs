#!/usr/bin/env node
/**
 * Issuer API — auto-issues verified credentials to newly-created travelers.
 *
 * Custodies the gov + loyalty issuer wallets SERVER-SIDE (the browser can't sign as these
 * trusted issuers). When a new traveler creates their identity in the browser, the wallet
 * calls POST /onboard {did} and this service issues:
 *   - Over-18 credential (from hatpro-gov, in the registry's admin group)
 *   - Loyalty Tier credential (from hatpro-loyalty, admin group)
 * Returns the VC DIDs for the wallet to accept. The traveler's own HATPro profile is
 * self-issued client-side (self-asserted) — this service only issues the verified VCs.
 *
 *   GET  /health
 *   POST /onboard  { did, tier? }  ->  { over18, loyaltyTier }
 */
import express from 'express';
import cors from 'cors';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import Keymaster from '@didcid/keymaster';
import WalletJson from '@didcid/keymaster/wallet/json';
import CipherNode from '@didcid/cipher/node';
import DrawbridgeClient from '@didcid/gatekeeper/drawbridge';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WALLET_DIR = join(ROOT, 'wallets');

const GATEKEEPER_URL = process.env.ARCHON_GATEKEEPER_URL || 'http://flaxlap.local:4222';
const REGISTRY = process.env.ARCHON_DEFAULT_REGISTRY || 'hyperswarm';
const PASSPHRASE = process.env.HATPRO_WALLET_PASSPHRASE || 'hatpro-demo-passphrase';
const PORT = parseInt(process.env.ISSUER_API_PORT || '4327', 10);

const demo = JSON.parse(readFileSync(join(ROOT, 'config', 'demo.json'), 'utf-8'));

const gatekeeper = new DrawbridgeClient();
await gatekeeper.connect({ url: GATEKEEPER_URL });
const cipher = new CipherNode();

/** Open one issuer wallet (server-side) and select its id. */
async function issuer(idName) {
  const wallet = new WalletJson(`${idName}.json`, WALLET_DIR);
  const km = new Keymaster({ gatekeeper, wallet, cipher, defaultRegistry: REGISTRY, passphrase: PASSPHRASE });
  await km.setCurrentId(idName);
  return km;
}
const gov = await issuer('hatpro-gov');
const loyalty = await issuer('hatpro-loyalty');

async function issueTo(km, subject, schema, claims) {
  const bound = await km.bindCredential(subject, { schema, claims });
  return km.issueCredential(bound, { registry: REGISTRY });
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, issuers: ['hatpro-gov', 'hatpro-loyalty'] }));

app.post('/onboard', async (req, res) => {
  const { did, tier } = req.body || {};
  if (!did || typeof did !== 'string' || !did.startsWith('did:')) {
    return res.status(400).json({ error: 'missing or invalid did' });
  }
  try {
    const over18 = await issueTo(gov, did, demo.schemas.over18, { over18: true, jurisdiction: 'US' });
    const loyaltyTier = await issueTo(loyalty, did, demo.schemas.loyaltyTier, {
      program: 'Seaside Rewards', tier: tier || 'gold', memberSince: '2024',
    });
    res.json({ over18, loyaltyTier });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`Issuer API on http://localhost:${PORT}`);
  console.log(`  gov     = ${demo.identities['hatpro-gov']}`);
  console.log(`  loyalty = ${demo.identities['hatpro-loyalty']}`);
});
