import { createContext, useContext, useEffect, useState } from 'react';
import {
  AppBar, Toolbar, Typography, Container, Box, Card, CardContent, Stack, Chip, TextField, MenuItem,
  Button, Alert, CircularProgress, Divider, Table, TableHead, TableBody, TableRow, TableCell, Tooltip,
  Tabs, Tab, IconButton,
} from '@mui/material';
import TravelExploreRoundedIcon from '@mui/icons-material/TravelExploreRounded';
import { AppConfig, loadConfig } from './config';
import { getMetadata, authorize, Metadata, AuthorizationResult } from './api';
import { DidResolver } from './DidResolver';

const short = (did: string) => (did ? `${did.slice(0, 16)}…${did.slice(-6)}` : '');
const RESOLVER_TAB = 1;

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
  const [meta, setMeta] = useState<Metadata | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const c = await loadConfig();
        setCfg(c);
        setMeta(await getMetadata(c.registryUrl));
      } catch (e: any) { setError(e?.message || String(e)); }
    })();
  }, []);

  if (error) return <Container sx={{ mt: 6 }}><Alert severity="error">{error}</Alert>
    <Typography sx={{ mt: 2 }} color="text.secondary">Is the trust registry running? <code>cd ~/projects/archon-trust-registry && npm run dev</code></Typography></Container>;
  if (!cfg || !meta) return <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 10, gap: 2 }}>
    <CircularProgress /><Typography color="text.secondary">Connecting to trust registry…</Typography></Box>;

  return <Explorer cfg={cfg} meta={meta} />;
}

function Explorer({ cfg, meta }: { cfg: AppConfig; meta: Metadata }) {
  const [tab, setTab] = useState(0);
  const [resolveTarget, setResolveTarget] = useState<string | null>(null);
  const resolve = (did: string) => { setResolveTarget(did); setTab(RESOLVER_TAB); };

  return (
    <ResolveContext.Provider value={resolve}>
      <AppBar position="static" color="primary" elevation={0}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>🛡️ HATPro Trust Registry Explorer</Typography>
          <Chip label={`${meta.name} · ${short(meta.authority_id)}`} sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff' }} />
          <Box sx={{ color: '#fff' }}><ResolveLink did={meta.authority_id} /></Box>
        </Toolbar>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} textColor="inherit" indicatorColor="secondary" sx={{ px: 2 }}>
          <Tab label="Registry" /><Tab label="Resolver" />
        </Tabs>
      </AppBar>
      <Container maxWidth="md" sx={{ py: 3 }}>
        {/* Keep both panels mounted so the Registry view (matrix, query result) survives a
            trip to the Resolver and back. */}
        <Box sx={{ display: tab === 0 ? 'block' : 'none' }}>
          <Typography color="text.secondary" paragraph>
            A ToIP TRQP v2.0 trust registry answers one question — <em>“is this entity authorized to do
            this action?”</em> — from Archon group membership. This is the layer the supplier consults to
            decide which credential issuers it trusts.
          </Typography>
          <Stack spacing={3}>
            <MetadataCard meta={meta} cfg={cfg} />
            <MatrixCard cfg={cfg} />
            <QueryCard cfg={cfg} />
          </Stack>
        </Box>
        <Box sx={{ display: tab === RESOLVER_TAB ? 'block' : 'none' }}>
          <DidResolver resolveDid={resolveViaGatekeeper(cfg.gatekeeperUrl)} target={resolveTarget} onResolve={resolve} />
        </Box>
      </Container>
    </ResolveContext.Provider>
  );
}

function MetadataCard({ meta, cfg }: { meta: Metadata; cfg: AppConfig }) {
  return (
    <Card><CardContent>
      <Typography variant="h6" gutterBottom>What this registry governs</Typography>
      <Stack spacing={0.5}>
        <Row label="Authority" value={`${cfg.friendlyName(meta.authority_id)} (${short(meta.authority_id)})`} />
        <Row label="TRQP version" value={meta.trqp_version} />
        <Row label="Query types" value={meta.supported_query_types.join(', ')} />
        <Row label="Actions" value={meta.supported_actions.join(', ')} />
      </Stack>
    </CardContent></Card>
  );
}

// The registry only gates these; holding/presenting your own credentials is permissionless.
const GATED_ACTIONS = ['issue', 'verify', 'revoke'];
const PERMISSIONLESS_ACTIONS = ['hold', 'present'];

function MatrixCard({ cfg }: { cfg: AppConfig }) {
  const [grid, setGrid] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const key = (did: string, action: string) => `${did}|${action}`;

  useEffect(() => {
    (async () => {
      const entries = await Promise.all(
        cfg.entities.flatMap((e) => GATED_ACTIONS.map(async (a) => {
          try {
            const r = await authorize(cfg.registryUrl, { authority_id: cfg.authorityDid, entity_id: e.did, action: a });
            return [key(e.did, a), r.authorized] as const;
          } catch { return [key(e.did, a), false] as const; }
        })),
      );
      setGrid(Object.fromEntries(entries));
      setLoading(false);
    })();
  }, []);

  const groupHeader = { fontWeight: 600, fontSize: 12, color: 'text.secondary', borderBottom: 'none' };

  return (
    <Card><CardContent>
      <Typography variant="h6" gutterBottom>Authorization matrix</Typography>
      <Typography color="text.secondary" paragraph>
        The registry gates <strong>issuance</strong> and accredits <strong>verifiers</strong>. Holding and
        presenting are <strong>permissionless</strong> — any self-sovereign holder may present their own
        credentials, so travelers need no authorization for those.
      </Typography>
      {loading ? <CircularProgress size={24} /> : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ borderBottom: 'none' }} />
              <TableCell align="center" colSpan={GATED_ACTIONS.length} sx={groupHeader}>registry-gated</TableCell>
              <TableCell align="center" colSpan={PERMISSIONLESS_ACTIONS.length} sx={groupHeader}>permissionless</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Entity</TableCell>
              {GATED_ACTIONS.map((a) => <TableCell key={a} align="center">{a}</TableCell>)}
              {PERMISSIONLESS_ACTIONS.map((a) => <TableCell key={a} align="center" sx={{ color: 'text.secondary' }}>{a}</TableCell>)}
            </TableRow>
          </TableHead>
          <TableBody>
            {cfg.entities.map((e) => (
              <TableRow key={e.did}>
                <TableCell><Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Tooltip title={e.did}><span>{e.label}</span></Tooltip><ResolveLink did={e.did} />
                </Box></TableCell>
                {GATED_ACTIONS.map((a) => (
                  <TableCell key={a} align="center">
                    {grid[key(e.did, a)]
                      ? <Box component="span" sx={{ color: 'success.main', fontWeight: 700 }}>✓</Box>
                      : <Box component="span" sx={{ color: 'text.disabled' }}>·</Box>}
                  </TableCell>
                ))}
                {PERMISSIONLESS_ACTIONS.map((a) => (
                  <TableCell key={a} align="center">
                    <Tooltip title="Permissionless — available to any holder"><Box component="span" sx={{ color: 'text.secondary' }}>✓</Box></Tooltip>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        ✓ under <em>registry-gated</em> is a live decision from the registry (Gov &amp; Seaside Rewards are
        admins → may issue; Seaside Resort is a member → may verify). ✓ under <em>permissionless</em> reflects
        that holding/presenting one's own credentials needs no authorization.
      </Typography>
    </CardContent></Card>
  );
}

function QueryCard({ cfg }: { cfg: AppConfig }) {
  const [entity, setEntity] = useState(cfg.entities[0].did);
  const [action, setAction] = useState('issue');
  const [resource, setResource] = useState('');
  const [result, setResult] = useState<AuthorizationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const run = async () => {
    setBusy(true); setMsg(''); setResult(null);
    try {
      if (PERMISSIONLESS_ACTIONS.includes(action)) {
        // Not a registry decision — holding/presenting your own credentials needs no authorization.
        setResult({
          entity_id: entity, authority_id: cfg.authorityDid, action, resource: resource || null,
          authorized: true,
          message: `“${action}” is permissionless — any holder may ${action} their own credentials. The registry does not gate this action.`,
        });
      } else {
        setResult(await authorize(cfg.registryUrl, {
          authority_id: cfg.authorityDid, entity_id: entity, action, resource: resource || undefined,
        }));
      }
    } catch (e: any) { setMsg('Error: ' + (e?.message || e)); } finally { setBusy(false); }
  };

  return (
    <Card><CardContent>
      <Typography variant="h6" gutterBottom>Run an authorization query</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
        <TextField select size="small" label="Entity" value={entity} onChange={(e) => setEntity(e.target.value)} sx={{ minWidth: 180 }}>
          {cfg.entities.map((e) => <MenuItem key={e.did} value={e.did}>{e.label}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Action" value={action} onChange={(e) => setAction(e.target.value)} sx={{ minWidth: 120 }}>
          {cfg.actions.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Resource (optional)" value={resource} onChange={(e) => setResource(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">— any —</MenuItem>
          {cfg.resources.map((r) => <MenuItem key={r.did} value={r.did}>{r.label}</MenuItem>)}
        </TextField>
        <Button variant="contained" onClick={run} disabled={busy}>Query</Button>
      </Stack>
      {msg && <Alert severity="error">{msg}</Alert>}
      {result && (
        <Box>
          <Chip color={result.authorized ? 'success' : 'error'} variant={result.authorized ? 'filled' : 'outlined'}
            label={result.authorized ? '✓ AUTHORIZED' : '✗ NOT AUTHORIZED'} sx={{ mb: 1, fontWeight: 600 }} />
          <Divider sx={{ my: 1 }} />
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-word' }}>{result.message}</Typography>
        </Box>
      )}
    </CardContent></Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <Box sx={{ display: 'flex', gap: 1 }}>
    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 110 }}>{label}</Typography>
    <Typography variant="body2">{value}</Typography>
  </Box>;
}
