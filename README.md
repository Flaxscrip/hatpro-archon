# HATPro on Archon

Reference implementation of the DIF **Hospitality & Travel Profile (HATPro)** on the
**Archon `did:cid`** identity layer. Target deployment: `hatpro.archon.technology`.

See [`docs/PLAN.md`](docs/PLAN.md) for architecture and [`docs/MILESTONE1-RESULTS.md`](docs/MILESTONE1-RESULTS.md)
for the validated capability mapping.

## Architecture: one wallet per actor
Each actor runs in its **own** Archon wallet (identities are HD-derived per seed and cannot
move between wallets), mirroring the real peer-to-peer model:

| Actor | Wallet | App |
|---|---|---|
| Traveler (Avery) | browser `WalletWeb` (self-custody) | `apps/traveler-wallet` (fork of `~/archon/apps/react-wallet`) |
| Supplier (Resort) | `WalletJson` file via keymaster REST server | `apps/supplier-console` (thin `@didcid/keymaster/client`) |
| Issuers (gov, loyalty) | `WalletJson` files | provisioned, no live UI |
| Registry authority | `WalletJson` file | provisions trust-registry groups |
| Trust registry (TRQP) | reads gatekeeper | `archon-trust-registry` + `apps/registry-explorer` |

## Setup
```bash
npm install
cp .env.example .env      # points at flaxlap.local:4222, registry hyperswarm
```

## Provision the demo (separate wallets, deterministic seeds)
```bash
npm run reset      # wipe wallets/ and re-provision all actors from fixed seeds
npm run verify     # run the full cross-wallet exchange + trust-registry checks
```
`provision` writes [`config/demo.json`](config) (all DIDs) which the three apps consume.
`config/schemas.json` holds the shared HATPro/Over18/LoyaltyTier schema DIDs.

> ⚠️ The provisioning seeds are **public** BIP-39 test vectors — deterministic, zero security,
> local demo only.

## Status
- ✅ Milestone 1 — headless proof-of-loop (single wallet)
- ✅ Milestone 2a — separate-wallet provisioning + cross-wallet verification
- ✅ Milestone 2b-i — backend services (Trust Registry TRQP + Resort keymaster API) — see [`docs/SERVICES.md`](docs/SERVICES.md)
- ✅ Milestone 2b-ii — all three web apps built: **traveler-wallet** (:4228), **supplier-console** (:4229), **registry-explorer** (:4231)
- ⬜ Milestone 3 — hosting at `hatpro.archon.technology`

### Run the supplier-console
```bash
cd apps/supplier-console && npm install && npm run dev   # http://localhost:4229
```
Thin client over the resort keymaster API (:4326) — compose a profile request, then verify a
traveler's presentation (cryptographic match + per-issuer ToIP trust). Holds no keys.

### Run the registry-explorer
```bash
cd apps/registry-explorer && npm install && npm run dev   # http://localhost:4231
```
Thin client over the TRQP trust registry (:4260) — registry metadata, a live authorization
matrix (who may do what), and an interactive authorization query.

### Run the traveler-wallet
```bash
npm run provision                 # if not already done (writes config/demo.json)
cd apps/traveler-wallet && npm install && npm run dev   # http://localhost:4228
```
In-process self-custody (`WalletWeb`); recovers Avery from her seed via `recoverId`, builds a
HATPro profile (asset `didDocumentData`), holds VCs, and consents/presents to a challenge.
