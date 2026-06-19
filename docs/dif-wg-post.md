# We built a working HATPro reference implementation on Archon (`did:cid`) — live to try

Following the invitation to prototype against the HATPro Implementation Guide (v1.1), we've
stood up an end-to-end demo of the traveler↔supplier flow on the Archon protocol. It's live
and public:

🔗 **https://hatpro.archon.technology** · code: https://github.com/Flaxscrip/hatpro-archon

**What it is.** Three small apps for the three roles:
- **Traveler Wallet** — self-custody identity created and held *in the browser*; build a
  HATPro profile, hold verified credentials, consent and present.
- **Supplier Console** — compose a profile request, then verify what's presented.
- **Registry Explorer** — a **ToIP TRQP v2.0** trust registry showing who's authorized to
  issue/verify.

It implements HATPro's **Request → Consent → Presentation → Verification** loop directly.
The traveler's profile lives in a traveler-owned, signed, versioned DID document; verified
credentials (e.g. Over-18, loyalty tier) come from trusted issuers, while the profile itself
is self-asserted — and the supplier sees that provenance distinction explicitly. The supplier
stores **zero PII**: it ends the exchange holding only verified claims.

Worth noting how `did:cid` models subject *types*: the profile, each credential, and the
schemas are all first-class resolvable/versioned/revocable DIDs (Archon "assets"), and the
trust registry is just group membership over those DIDs exposed through TRQP.

**Candid about scope — two divergences we'd value WG input on:**
1. **Transport.** We use Archon-native encrypted messaging, *not* DIDComm or the ToIP Trust
   Spanning Protocol. A bridge for cross-ecosystem interop is future work.
2. **Selective disclosure.** We disclose at credential/claim-*composition* granularity
   (present only the requested credentials), *not* ZK/BBS+ predicate proofs — so "prove
   over-18" is a narrow Over-18 credential rather than a predicate over date-of-birth.

Happy to walk through any of it, or present at a WG call if useful. Feedback very welcome.
