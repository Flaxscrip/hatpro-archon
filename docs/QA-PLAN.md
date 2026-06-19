# HATPro-on-Archon — Review / QA Plan

What's built so far and how to review it. Everything runs against the local node
(`flaxlap.local:4222`, registry `hyperswarm`). All services are currently **running**.

## Status of the running stack
| Service | Link | What it is |
|---|---|---|
| Traveler wallet (UI) | http://localhost:4228 | The one app with a UI today — the traveler experience |
| Trust registry (TRQP) | http://localhost:4260/metadata | ToIP TRQP v2.0 — "is this issuer authorized?" |
| Resort keymaster API | http://localhost:4326/health | Supplier backend (server-side resort wallet) |
| Archon node | http://flaxlap.local:4222 | Public gatekeeper (DID resolution/anchoring) |

| Supplier console (UI) | http://localhost:4229 | Supplier view — compose request, verify presentation |

> Scope note: **registry-explorer** UI is NOT built yet — only its backend (TRQP) exists.
> traveler-wallet and supplier-console are clickable; registry behaviour is reviewable via the
> API checks in Part B.

---

## Part A2 — Supplier console + full two-sided loop
Open **http://localhost:4229** (needs the resort API on :4326).
1. [ ] Header shows `Seaside Resort · did:cid:…` (identity loaded from the backend).
2. [ ] **Compose**: both credentials checked → **Create request** → a Challenge DID appears (copy it).
3. [ ] Paste that challenge into the **traveler-wallet** (:4228) Requests tab → **Consent & present** → copy the Response DID.
4. [ ] Back in the console → **Verify presentation** → paste the Response DID → **Verify**.
   - [ ] Big green **✓ ACCEPTED** banner.
   - [ ] Sub-checks: cryptographic match (2/2), all issuers trusted, responder = Avery.
   - [ ] Per-credential rows show friendly names, claims, and "issuer authorized" ✓.
5. [ ] Negative: uncheck one credential, create a new request, present (traveler only has both) —
   still accepted; or paste a garbage Response DID → graceful error, no crash.

---

## Part A — Traveler wallet walkthrough (main review)
Open **http://localhost:4228**. The app self-custodies Avery's keys in your browser
(`WalletWeb`); the node is used only as the public gatekeeper.

1. **Loads & recovers identity**
   - [ ] Page loads; brief "Recovering traveler identity…" spinner, then the wallet appears.
   - [ ] Top-right chip shows `Avery · did:cid:…7ea` (matches the provisioned Avery DID).

2. **Identity tab**
   - [ ] Shows the Traveler DID, registry (`hyperswarm`), and HATPro profile schema DID.

3. **Credentials tab**
   - [ ] Avery's two VCs appear (Over18 from gov, LoyaltyTier from loyalty) with issuer + claims.
   - [ ] If a blue "pending acceptance" banner shows instead, click **Accept** → they render.

4. **Profile tab**
   - [ ] Form is pre-filled with a sample HATPro profile (vegetarian, peanuts allergy, etc.).
   - [ ] Click **Save profile** → success message + a "Profile asset DID" appears
         (the profile is now a traveler-owned asset DID with `didDocumentData`).

5. **Requests tab — the consent/present flow** (the heart of HATPro)
   - [ ] Paste this fresh supplier profile-request (challenge) DID:
     ```
     did:cid:bagaaiera3id2qdjfhvc7fuyfsnjpxj3yqgq4xvnrq5hw7ezzi57vbccdoc4q
     ```
   - [ ] Click **Review request** → shows what the supplier is asking for (Over18 + LoyaltyTier
         from the named trusted issuers).
   - [ ] Click **Consent & present** → success + a **Response DID** you can copy.
   - [ ] (Optional) send me that Response DID and I'll run it through the supplier's `/verify`
         to show the full accept verdict (crypto + trust).

### Things worth a critical eye
- Does the flow make the **consent step** obvious (you see the request before sharing)?
- Is it clear the **node never holds the traveler's keys**?
- Any rough edges in copy, layout, or terminology for a DIF audience?

---

## Part B — Backend review (no UI yet; browser links + curl)

**Trust registry (TRQP)**
- Browse: http://localhost:4260/metadata — what the registry governs.
- Positive authorization (gov may issue):
  ```bash
  curl -s -X POST http://localhost:4260/authorization -H 'Content-Type: application/json' \
   -d '{"authority_id":"did:cid:bagaaierakdwq47cfhr3baawsqp2qmplshvakk7qneqhfgefsk4xlbawhezha",
        "entity_id":"did:cid:bagaaiera5rjmhtzdaw7mbkbeg4u2cb55xzihkrnzcbus4pvojsoblczygfta",
        "action":"issue"}'
  ```
  → expect `"authorized": true … (role: admin)`.
- Negative (traveler may NOT issue): swap `entity_id` for Avery's DID
  (`did:cid:bagaaiera47msjr73l4pgnwhc7io62h3fqt3tpfztucajmbera2yrjeq2n7ea`) → `"authorized": false`.

**Resort keymaster API (supplier backend)**
- http://localhost:4326/health and http://localhost:4326/id — confirms it custodies the
  resort identity server-side.

**Full automated chains (from `~/projects/hatpro-archon`)**
```bash
npm run verify          # cross-wallet request→consent→present→verify + trust checks
npm run test-supplier   # same flow over the supplier HTTP API → "SUPPLIER ACCEPTS"
```

---

## If something's down
Restart from `~/projects/hatpro-archon`:
```bash
npm run resort-api &                                   # :4326
(cd ../archon-trust-registry && npm run dev &)         # :4260
(cd apps/traveler-wallet && npm run dev &)             # :4228
```
Re-provision the whole demo (new DIDs) only if needed: `npm run reset` (then regenerate the
trust-registry `.env` per `docs/SERVICES.md`).
