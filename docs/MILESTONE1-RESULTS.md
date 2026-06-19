# Milestone 1 — Headless proof-of-loop ✅ COMPLETE

Date: 2026-06-17 · Node: `flaxlap.local:4222` · Registry: `hyperswarm`

The **entire HATPro flow runs end-to-end on Archon**, executed live via the GenitriX
Archon MCP server. All DIDs are real and revocable; see `artifacts/milestone1-artifacts.json`.

## What was proven
| HATPro step | Archon action | Result |
|---|---|---|
| Profile schema published | `create_schema` (HATPro JSON Schema subset) | ✅ schema DID |
| Traveler-owned profile | `create_asset_json` → `didDocumentData` | ✅ asset DID |
| Trusted issuers credential a traveler | gov→Over18, loyalty→LoyaltyTier (`bind`+`issue`) | ✅ 2 VCs |
| Traveler holds credentials | `accept_credential` | ✅ |
| Supplier profile **request** | `create_challenge` (schema + authorized issuers) | ✅ challenge DID |
| Traveler **consent + selective presentation** | `create_response` | ✅ response DID |
| Supplier **verification** | `verify_response` | ✅ `requested:2 fulfilled:2 match:true` |
| **Trust registry authorization (ToIP logic)** | `test_group` (issuer/verifier roles) | ✅ incl. negative test |

## Trust registry checks (the logic archon-trust-registry exposes over TRQP)
- gov ∈ admin → **authorized to issue** ✅
- loyalty ∈ admin → **authorized to issue** ✅
- resort ∈ member → **authorized to verify** ✅
- avery ∈ admin → **false** (traveler correctly cannot issue) ✅ ← negative control

## Key takeaways for the WG writeup
1. Archon's `challenge → response → verify` maps **1:1** onto HATPro's
   Request → Consent → Presentation → Verification, with issuer-allowlisting built into
   the challenge itself.
2. The traveler profile lives in a **traveler-owned asset DID** (`didDocumentData`) — the
   exact "create once, share selectively" container HATPro describes.
3. Issuer trust is enforced two ways that reinforce each other: (a) the challenge names
   acceptable issuers; (b) the ToIP trust registry answers "is this issuer authorized?"
   from the same Archon group graph.
4. The supplier ends the exchange holding **verified claims and zero stored PII**.

## Next: Milestone 2 (three web apps)
`apps/traveler-wallet`, `apps/supplier-console`, `apps/registry-explorer` — Vite + React +
`@didcid/keymaster` on this proven backend, plus the archon-trust-registry TRQP server.
