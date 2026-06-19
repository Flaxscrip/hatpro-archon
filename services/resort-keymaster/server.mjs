#!/usr/bin/env node
/**
 * Supplier (Resort) keymaster API — purpose-scoped.
 *
 * Custodies the hatpro-resort wallet SERVER-SIDE and exposes only the operations a
 * supplier needs, so supplier-console stays a thin client (no keys in the browser):
 *
 *   GET  /health            -> { ok, did }
 *   GET  /id                -> { name, did }
 *   POST /profile-request   -> { challenge }          body: { credentials:[{schema,issuers}] }
 *   POST /verify            -> combined result        body: { response }
 *
 * /verify does TWO things, which is the whole supplier value proposition:
 *   1. Archon cryptographic verification of the presentation (verifyResponse)
 *   2. ToIP TRQP issuer-trust check per presented credential (trust-registry /authorization)
 *
 * NOTE: this is a deliberately small, supplier-scoped service rather than the stock
 * archon keymaster-server. It keeps the demo self-contained and exposes far less than the
 * full key-custody REST surface. Swap in services/keymaster/server for max fidelity later.
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const WALLET_DIR = join(ROOT, 'wallets');

const GATEKEEPER_URL = process.env.ARCHON_GATEKEEPER_URL || 'http://flaxlap.local:4222';
const REGISTRY = process.env.ARCHON_DEFAULT_REGISTRY || 'hyperswarm';
const PASSPHRASE = process.env.HATPRO_WALLET_PASSPHRASE || 'hatpro-demo-passphrase';
const PORT = parseInt(process.env.RESORT_KEYMASTER_PORT || '4326', 10);
const TRUST_REGISTRY_URL = process.env.TRUST_REGISTRY_URL || 'http://localhost:4260';
const ID_NAME = 'hatpro-resort';

const demo = JSON.parse(readFileSync(join(ROOT, 'config', 'demo.json'), 'utf-8'));
const REGISTRY_DID = demo.identities['hatpro-registry'];

const gatekeeper = new DrawbridgeClient();
await gatekeeper.connect({ url: GATEKEEPER_URL });
const cipher = new CipherNode();
const wallet = new WalletJson(`${ID_NAME}.json`, WALLET_DIR);
const keymaster = new Keymaster({ gatekeeper, wallet, cipher, defaultRegistry: REGISTRY, passphrase: PASSPHRASE });
await keymaster.setCurrentId(ID_NAME);
const RESORT_DID = await keymaster.getCurrentDID?.() ?? demo.identities[ID_NAME];

/** Ask the ToIP trust registry whether `issuer` is authorized to issue `schema`. */
async function issuerAuthorized(issuer, schema) {
  try {
    const res = await fetch(`${TRUST_REGISTRY_URL}/authorization`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authority_id: REGISTRY_DID, entity_id: issuer, action: 'issue', resource: schema }),
    });
    const j = await res.json();
    return { authorized: !!j.authorized, message: j.message };
  } catch (e) {
    return { authorized: false, message: `trust-registry unreachable: ${e.message}` };
  }
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, id: ID_NAME, did: demo.identities[ID_NAME] }));
app.get('/id', (_req, res) => res.json({ name: ID_NAME, did: demo.identities[ID_NAME] }));

app.post('/profile-request', async (req, res) => {
  try {
    const challenge = await keymaster.createChallenge(req.body, { registry: REGISTRY });
    res.json({ challenge });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/verify', async (req, res) => {
  try {
    const { response } = req.body;
    if (!response) return res.status(400).json({ error: 'missing response DID' });
    const result = await keymaster.verifyResponse(response);

    // Per-credential evaluation. A credential whose issuer == subject is SELF-ASSERTED
    // (e.g. the traveler's own HATPro profile) — trust isn't required, it's just shown as
    // self-reported. Credentials from a distinct issuer must pass the ToIP trust check.
    const credentials = await Promise.all((result.vps || []).map(async (vp) => {
      const issuer = vp.issuer;
      const schema = vp.credentialSchema?.id;
      const subject = vp.credentialSubject?.id;
      const selfAsserted = issuer === subject;
      const trust = selfAsserted
        ? { authorized: false, message: 'self-asserted by the traveler (not from a trusted issuer)' }
        : await issuerAuthorized(issuer, schema);
      return {
        schema, issuer, claims: vp.credentialSubject, selfAsserted,
        issuerAuthorized: trust.authorized, trustMessage: trust.message,
      };
    }));

    // Accept when the presentation matches cryptographically AND every VERIFIED (non-self-
    // asserted) credential is from a trusted issuer.
    const verified = credentials.filter((c) => !c.selfAsserted);
    const verifiedTrusted = verified.every((c) => c.issuerAuthorized);
    res.json({
      cryptographicMatch: result.match,
      requested: result.requested,
      fulfilled: result.fulfilled,
      responder: result.responder,
      allIssuersTrusted: verifiedTrusted,
      accepted: result.match && verifiedTrusted,
      credentials,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Resort keymaster API on http://localhost:${PORT}`);
  console.log(`  id ${ID_NAME} = ${demo.identities[ID_NAME]}`);
  console.log(`  trust registry: ${TRUST_REGISTRY_URL}`);
});
