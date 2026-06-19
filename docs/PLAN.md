# HATPro on Archon — Demonstration Prototype

Implementing the DIF **Hospitality & Travel Profile (HATPro)** schema + Implementation
Guide (v1.1, June 2026) on **Archon** (`did:cid`), to be hosted at
`hatpro.archon.technology`.

- HATPro: https://htwg.identity.foundation/hatpro/ · repo https://github.com/decentralized-identity/hatpro-schema
- Archon whitepaper: https://github.com/archetech/archon/blob/main/docs/WHITEPAPER.md
- Trust registry (ToIP TRQP v2.0): https://github.com/archetech/archon-trust-registry

## Why this matters
HATPro is **open for public review & prototyping**. A working Archon reference
implementation is a high-value contribution to DIF and a showcase of `did:cid`.

## Capability mapping (HATPro → Archon) — no remaining gaps
| HATPro requirement | Archon mechanism |
|---|---|
| Traveler-owned SSI identity | `did:cid` agent DID + keymaster wallet |
| Portable signed profile (JSON) | **asset DID + `didDocumentData`** (schema-free, signed, versioned) |
| Secure storage / data vaults | `create_vault` / `add_vault_item` / `add_vault_member` |
| Verifiable Credentials | `create_schema` → `bind_credential` → `issue_credential` |
| Request → Consent → Present → Verify | `create_challenge` → `create_response` → `verify_response` |
| **Trusted-issuer check (ToIP)** | **archon-trust-registry TRQP `/authorization`** (backed by groups) |
| Selective disclosure | credential-composition in response (NOT ZK predicates — honest scope) |
| Secure P2P comms | encrypted `dmail` / `encrypt_message` |
| Data provenance | issuer-signed VC vs self-signed `didDocumentData` |
| Revocation / lifecycle | `revoke_credential` / `revoke_did` |
| Key rotation & recovery | `rotate_keys` / `recover_id` (BIP-39) |

### Known divergences to raise with the WG
- **Transport:** HATPro references DIDComm + ToIP Trust Spanning Protocol; Archon uses
  native encrypted dmail. Interop bridge is future work.
- **Selective disclosure:** Archon selects at credential/claim-composition granularity;
  no ZK/BBS+ predicate proofs today. "Prove over-18" = a narrow Over18 VC.

## Actors (all `did:cid`, registry `hyperswarm`, dev node `flaxlap.local:4222`)
| Alias | Role |
|---|---|
| `hatpro-avery` | Traveler (+ AI agent = GenitriX) |
| `hatpro-resort` | Supplier / verifier |
| `hatpro-gov` | Trusted issuer (identity / Over18) |
| `hatpro-loyalty` | Trusted issuer (loyalty tier) |
| `hatpro-registry` | Trust registry authority (owner/admin/member groups) |

## Web interfaces (decision: THREE SEPARATE APPS)
Vite + React + `@didcid/keymaster` (browser, with Buffer polyfill shim).
- `apps/traveler-wallet` — build/manage HATPro profile, receive requests, consent & present
- `apps/supplier-console` — compose profile request, send, verify presentation + TRQP check
- `apps/registry-explorer` — TRQP authorization/recognition query UI over archon-trust-registry

## Milestones
1. **Headless proof-of-loop** (MCP, this phase): mint identities, schemas, profile, VCs,
   groups; run challenge→consent→response→verify + authorization check. Artifacts saved
   to `artifacts/`.
2. **Web UI** — three apps above on the proven backend + trust-registry server.
3. **Hosting** — nginx server-block(s) for `hatpro.archon.technology` + registry service.

## Wallet / process topology (FINAL)
Each actor = its own wallet (IDs are HD-derived per seed and cannot move between wallets).
The 3 schemas from Milestone 1 carry over (referenced by DID); actor IDs + registry groups
are re-provisioned per wallet.

| Actor | Wallet store | Keymaster mode | Process |
|---|---|---|---|
| Traveler (Avery) | `WalletWeb` (browser, self-custody) | in-process | `traveler-wallet` SPA — fork of `~/archon/apps/react-wallet` |
| Supplier (Resort) | `WalletJson` file | **API** | dedicated keymaster REST server (`services/keymaster/server`) + thin `supplier-console` (`@didcid/keymaster/client`) |
| Issuers (gov, loyalty) | `WalletJson` files | provisioning script | seed-time only |
| Registry authority | `WalletJson` file | provisioning (groups) | one-time |
| Trust registry (TRQP) | reads gatekeeper | n/a | `archon-trust-registry` (4260) ← `registry-explorer` |

## Decisions log
- UI shape: three separate apps
- Dev node: local `flaxlap.local:4222` (registry `hyperswarm`)
- Each identity in its own wallet (not use-id switching in one wallet)
- traveler-wallet: white-label fork of `~/archon/apps/react-wallet` (in-process `WalletWeb`)
- supplier-console: **API pattern** — dedicated keymaster REST server custodies resort wallet
- Provisioning: **scripted with deterministic seeds** (fixed mnemonics → reproducible/resettable)
