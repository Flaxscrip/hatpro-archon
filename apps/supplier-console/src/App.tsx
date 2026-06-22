import { createContext, useContext, useEffect, useState } from 'react';
import {
  AppBar, Toolbar, Typography, Container, Box, Card, CardContent, TextField, Button, Stack,
  Chip, Checkbox, FormControlLabel, Alert, CircularProgress, Divider, Link, Tabs, Tab, Tooltip, IconButton,
} from '@mui/material';
import TravelExploreRoundedIcon from '@mui/icons-material/TravelExploreRounded';
import JsonView from '@uiw/react-json-view';
import { AppConfig, loadConfig } from './config';
import { getId, createRequest, verify, VerifyResult, VerifyCredential } from './api';
import { DidResolver } from './DidResolver';

const short = (did: string) => (did ? `${did.slice(0, 16)}…${did.slice(-6)}` : '');
const RESOLVER_TAB = 1;

// Resolve a DID via the public gatekeeper (this app doesn't run keymaster).
const resolveViaGatekeeper = (gk: string) => async (did: string) => {
  const res = await fetch(`${gk}/api/v1/did/${encodeURIComponent(did)}`);
  if (!res.ok) throw new Error(`gatekeeper returned ${res.status}`);
  return res.json();
};

const ResolveContext = createContext<(did: string) => void>(() => {});

function ResolveLink({ did }: { did: string }) {
  const resolve = useContext(ResolveContext);
  if (!did) return null;
  return (
    <Tooltip title="Resolve this DID">
      <IconButton size="small" onClick={() => resolve(did)} aria-label="resolve DID">
        <TravelExploreRoundedIcon fontSize="inherit" />
      </IconButton>
    </Tooltip>
  );
}

export default function App() {
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [supplier, setSupplier] = useState<{ name: string; did: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const c = await loadConfig();
        setCfg(c);
        setSupplier(await getId(c.resortApiUrl));
      } catch (e: any) { setError(e?.message || String(e)); }
    })();
  }, []);

  if (error) return <Container sx={{ mt: 6 }}><Alert severity="error">{error}</Alert>
    <Typography sx={{ mt: 2 }} color="text.secondary">Is the resort keymaster API running? <code>npm run resort-api</code></Typography></Container>;
  if (!cfg || !supplier) return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 10, gap: 2 }}>
      <CircularProgress /><Typography color="text.secondary">Connecting to supplier backend…</Typography>
    </Box>
  );

  return <Console cfg={cfg} supplier={supplier} />;
}

function Console({ cfg, supplier }: { cfg: AppConfig; supplier: { name: string; did: string } }) {
  const [tab, setTab] = useState(0);
  const [resolveTarget, setResolveTarget] = useState<string | null>(null);
  const resolve = (did: string) => { setResolveTarget(did); setTab(RESOLVER_TAB); };

  return (
    <ResolveContext.Provider value={resolve}>
      <AppBar position="static" color="primary" elevation={0}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>🏨 HATPro Supplier Console</Typography>
          <Chip label={`Seaside Resort · ${short(supplier.did)}`} sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff' }} />
          <Box sx={{ color: '#fff' }}><ResolveLink did={supplier.did} /></Box>
        </Toolbar>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} textColor="inherit" indicatorColor="secondary" sx={{ px: 2 }}>
          <Tab label="Console" /><Tab label="Resolver" />
        </Tabs>
      </AppBar>
      <Container maxWidth="md" sx={{ py: 3 }}>
        {/* Both panels stay mounted (display toggle) so the Console keeps its request/verdict
            state when you pop over to the Resolver and back. */}
        <Box sx={{ display: tab === 0 ? 'block' : 'none' }}>
          <Typography color="text.secondary" paragraph>
            The supplier's keys are held server-side by the resort keymaster API — this console is a
            thin client. Compose a profile request for the traveler, then verify what they present:
            both the cryptographic proof and each issuer's authority (via the trust registry).
          </Typography>
          <Stack spacing={3}>
            <ComposeCard cfg={cfg} />
            <VerifyCard cfg={cfg} />
          </Stack>
        </Box>
        <Box sx={{ display: tab === RESOLVER_TAB ? 'block' : 'none' }}>
          <DidResolver resolveDid={resolveViaGatekeeper(cfg.gatekeeperUrl)} target={resolveTarget} onResolve={resolve} />
        </Box>
      </Container>
    </ResolveContext.Provider>
  );
}

function ComposeCard({ cfg }: { cfg: AppConfig }) {
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries(cfg.catalog.map((c) => [c.key, true])),
  );
  const [challenge, setChallenge] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const toggle = (k: string) => setSelected((s) => ({ ...s, [k]: !s[k] }));
  const chosen = cfg.catalog.filter((c) => selected[c.key]);

  const create = async () => {
    setBusy(true); setMsg(''); setChallenge('');
    try {
      const credentials = chosen.map((c) => (c.issuer ? { schema: c.schema, issuers: [c.issuer] } : { schema: c.schema }));
      const { challenge } = await createRequest(cfg.resortApiUrl, credentials);
      setChallenge(challenge);
    } catch (e: any) { setMsg('Error: ' + (e?.message || e)); } finally { setBusy(false); }
  };

  return (
    <Card><CardContent>
      <Typography variant="h6" gutterBottom>1 · Compose profile request</Typography>
      <Typography color="text.secondary" paragraph>Choose what to ask the traveler for. Each credential
        is only accepted from a trusted issuer.</Typography>
      <Stack>
        {cfg.catalog.map((c) => (
          <FormControlLabel key={c.key}
            control={<Checkbox checked={!!selected[c.key]} onChange={() => toggle(c.key)} />}
            label={<span>{c.label} <Typography component="span" variant="caption" color="text.secondary">— from {c.issuerLabel}</Typography></span>} />
        ))}
      </Stack>
      <Box sx={{ mt: 1 }}>
        <Button variant="contained" onClick={create} disabled={busy || chosen.length === 0}>
          {busy ? 'Creating…' : 'Create request'}
        </Button>
      </Box>
      {msg && <Alert severity="error" sx={{ mt: 2 }}>{msg}</Alert>}
      {challenge && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">Challenge DID — hand this to the traveler</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}>{challenge}</Typography>
            <Link component="button" variant="caption" onClick={() => navigator.clipboard.writeText(challenge)}>copy</Link>
            <ResolveLink did={challenge} />
          </Box>
        </Box>
      )}
    </CardContent></Card>
  );
}

function VerifyCard({ cfg }: { cfg: AppConfig }) {
  const [response, setResponse] = useState('');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const run = async () => {
    setBusy(true); setMsg(''); setResult(null);
    try { setResult(await verify(cfg.resortApiUrl, response.trim())); }
    catch (e: any) { setMsg('Error: ' + (e?.message || e)); } finally { setBusy(false); }
  };

  return (
    <Card><CardContent>
      <Typography variant="h6" gutterBottom>2 · Verify presentation</Typography>
      <Typography color="text.secondary" paragraph>Paste the response DID the traveler presents.</Typography>
      <Stack spacing={2}>
        <TextField label="Response DID" value={response} onChange={(e) => setResponse(e.target.value)} fullWidth />
        <Box><Button variant="contained" onClick={run} disabled={!response || busy}>{busy ? 'Verifying…' : 'Verify'}</Button></Box>
        {msg && <Alert severity="error">{msg}</Alert>}
        {result && (() => {
          // Prefer the traveler's name from their presented profile over the raw DID.
          const travelerName = result.credentials.find((c) => c.claims?.identity?.displayName)?.claims?.identity?.displayName
            || cfg.friendlyName(result.responder);
          return (
          <Box>
            <Alert severity={result.accepted ? 'success' : 'error'} sx={{ mb: 2, fontWeight: 600 }}>
              {result.accepted ? `✓ ACCEPTED — verified presentation from ${travelerName}` : '✗ NOT ACCEPTED'}
            </Alert>
            <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', gap: 1 }}>
              <Check ok={result.cryptographicMatch} label={`Cryptographic match (${result.fulfilled}/${result.requested})`} />
              <Check ok={result.allIssuersTrusted} label="Verified issuers trusted" />
              <Chip size="small" variant="outlined" label={`from: ${travelerName}`} />
            </Stack>
            <Divider sx={{ my: 1 }} />
            <Stack spacing={1.5}>
              {result.credentials.map((c, i) => <CredentialRow key={i} c={c} cfg={cfg} />)}
            </Stack>
          </Box>
          );
        })()}
      </Stack>
    </CardContent></Card>
  );
}

function CredentialRow({ c, cfg }: { c: VerifyCredential; cfg: AppConfig }) {
  const claims = { ...c.claims };
  delete (claims as any).id;
  return (
    <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>{cfg.friendlyName(c.schema)}</Typography>
        <ResolveLink did={c.schema} />
        {c.selfAsserted
          ? <Chip size="small" color="warning" variant="outlined" label="self-asserted" />
          : <Check ok={c.issuerAuthorized} label={c.issuerAuthorized ? 'verified' : 'issuer NOT authorized'} />}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {c.selfAsserted ? 'self-issued by the traveler (unverified)' : `issued by ${cfg.friendlyName(c.issuer)}`}
        </Typography>
        <ResolveLink did={c.issuer} />
      </Box>
      <Box sx={{ mt: 0.5 }}><JsonView value={claims} collapsed={2} displayDataTypes={false} /></Box>
    </Box>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return <Chip size="small" color={ok ? 'success' : 'error'} variant={ok ? 'filled' : 'outlined'}
    label={`${ok ? '✓' : '✗'} ${label}`} />;
}
