# Backend services

Two backend services support the supplier-console and registry-explorer apps. The
traveler-wallet needs neither (in-process self-custody).

## 1. Trust Registry (ToIP TRQP v2.0) — port 4260
The stock [`archon-trust-registry`](https://github.com/archetech/archon-trust-registry),
cloned at `~/projects/archon-trust-registry`, configured for our HATPro registry.

```bash
cd ~/projects/archon-trust-registry
npm install
npm run dev          # tsx watch, port 4260
```
Its `.env` is generated from `hatpro-archon/config/demo.json` (REGISTRY_DID, ADMIN_GROUP,
MEMBER_GROUP, GATEKEEPER_URL). Regenerate after every `npm run reset`:
```bash
cd ~/projects/archon-trust-registry && node -e "
const d=require('../hatpro-archon/config/demo.json');
require('fs').writeFileSync('.env',[
 'REGISTRY_DID='+d.identities['hatpro-registry'],'REGISTRY_NAME=HATPro Trust Registry',
 'GATEKEEPER_URL='+d.node,'RESOURCE_FORMAT=both','PORT=4260',
 'OWNER_GROUP=','ADMIN_GROUP='+d.groups.admin,'MODERATOR_GROUP=','MEMBER_GROUP='+d.groups.member,''
].join('\n'));"
```

Verified endpoints:
- `GET  /metadata` — what the registry governs
- `POST /authorization` — `{authority_id, entity_id, action, resource}` → `{authorized, message}`
- `POST /recognition` — peer-authority recognition

Confirmed: gov/loyalty → `authorized:true (role: admin)`; avery → `authorized:false`.

## 2. Resort keymaster API (supplier) — port 4326
`services/resort-keymaster/server.mjs` — custodies the **hatpro-resort** wallet server-side
so `supplier-console` holds no keys. Purpose-scoped (NOT the full keymaster REST surface).

```bash
cd ~/projects/hatpro-archon
npm run resort-api    # port 4326; needs TRUST_REGISTRY_URL (default http://localhost:4260)
```
Endpoints:
- `GET  /health`, `GET /id`
- `POST /profile-request` — `{credentials:[{schema,issuers}]}` → `{challenge}`
- `POST /verify` — `{response}` → `{cryptographicMatch, allIssuersTrusted, accepted, credentials[]}`
  combining **Archon crypto verification** + a **TRQP issuer-trust check per credential**.

End-to-end test (request → traveler responds → verify):
```bash
npm run test-supplier   # expects both services running + provisioned wallets
```
Confirmed verdict: `cryptographicMatch:true, allIssuersTrusted:true, accepted:true`.

## Port map
| Port | Service |
|---|---|
| 4222 | Archon node / Drawbridge (flaxlap.local) |
| 4260 | Trust Registry (TRQP) |
| 4326 | Resort keymaster API (supplier) |
