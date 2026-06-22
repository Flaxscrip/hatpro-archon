import { createContext, useContext, useEffect, useState } from 'react';
import {
  AppBar, Toolbar, Typography, Container, Box, Tabs, Tab, Card, CardContent, TextField,
  Button, Stack, Chip, MenuItem, FormControlLabel, Switch, Alert, CircularProgress, Divider, Link,
  List, ListItem, ListItemText, IconButton, Collapse, Tooltip,
} from '@mui/material';
import TravelExploreRoundedIcon from '@mui/icons-material/TravelExploreRounded';
import JsonView from '@uiw/react-json-view';
import type Keymaster from '@didcid/keymaster';
import { AppConfig, loadConfig } from './config';
import { buildKeymaster, currentIdentity, createTraveler, saveProfileCredential, heldSchemas, resetWallet, Identity } from './keymaster';
import { HatproProfile, sampleProfile, csv, parseCsv } from './hatproProfile';
import { AliasEntry, loadAliases } from './aliases';
import { DidResolver } from './DidResolver';

const RESOLVER_TAB = 5;

// Lets any DID icon, anywhere in the tree, jump to the Resolver tab and resolve that DID.
const ResolveContext = createContext<(did: string) => void>(() => {});

/** Small icon-button next to a DID that opens it in the in-app Resolver tab. */
function ResolveLink({ did }: { did: string }) {
  const resolve = useContext(ResolveContext);
  return (
    <Tooltip title="Resolve this DID">
      <IconButton size="small" onClick={() => resolve(did)} aria-label="resolve DID">
        <TravelExploreRoundedIcon fontSize="inherit" />
      </IconButton>
    </Tooltip>
  );
}

const short = (did: string) => (did ? `${did.slice(0, 18)}…${did.slice(-6)}` : '');

export default function App() {
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [km, setKm] = useState<Keymaster | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  const [resolveTarget, setResolveTarget] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const c = await loadConfig();
        setCfg(c);
        const k = await buildKeymaster(c);
        setKm(k);
        setIdentity(await currentIdentity(k));
      } catch (e: any) { setError(e?.message || String(e)); }
    })();
  }, []);

  if (error) return <Container sx={{ mt: 6 }}><Alert severity="error">{error}</Alert></Container>;
  if (!cfg || !km) return <Loading text="Starting wallet…" />;
  if (!identity) return <Onboarding km={km} cfg={cfg} onCreated={(id) => { setIdentity(id); setTab(0); }} />;

  // Jump to the Resolver tab and resolve a DID — invoked by the resolve-icon anywhere.
  const resolve = (did: string) => { setResolveTarget(did); setTab(RESOLVER_TAB); };

  return (
    <ResolveContext.Provider value={resolve}>
      <AppBar position="static" color="primary" elevation={0}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>🧳 HATPro Traveler Wallet</Typography>
          <Chip label={`${identity.name} · ${short(identity.did)}`} sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff' }} />
        </Toolbar>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} textColor="inherit" indicatorColor="secondary" sx={{ px: 2 }} variant="scrollable">
          <Tab label="Identity" /><Tab label="Profile" /><Tab label="Credentials" /><Tab label="Address Book" /><Tab label="Requests" /><Tab label="Resolver" />
        </Tabs>
      </AppBar>
      <Container maxWidth="md" sx={{ py: 3 }}>
        {tab === 0 && <IdentityTab cfg={cfg} identity={identity} onNewTraveler={() => setIdentity(null)} />}
        {tab === 1 && <ProfileTab km={km} cfg={cfg} identity={identity} />}
        {tab === 2 && <CredentialsTab km={km} />}
        {tab === 3 && <AliasesTab km={km} cfg={cfg} />}
        {tab === 4 && <RequestsTab km={km} cfg={cfg} />}
        {tab === RESOLVER_TAB && <DidResolver resolveDid={(d) => km.resolveDID(d)} target={resolveTarget} onResolve={resolve} />}
      </Container>
    </ResolveContext.Provider>
  );
}

function Loading({ text }: { text: string }) {
  return <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 10, gap: 2 }}>
    <CircularProgress /><Typography color="text.secondary">{text}</Typography></Box>;
}

function Onboarding({ km, cfg, onCreated }: { km: Keymaster; cfg: AppConfig; onCreated: (id: Identity) => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [pending, setPending] = useState<Identity | null>(null); // created, but issuer was unreachable

  const create = async () => {
    setBusy(true); setMsg('');
    try {
      const { identity, verifiedIssued } = await createTraveler(km, cfg, name.trim());
      if (verifiedIssued) { onCreated(identity); return; }
      // Identity created but the issuer service was offline — let the operator decide.
      setPending(identity);
      setMsg("Your identity was created, but the credential issuer is unreachable, so you won't have verified credentials. You can still build and present a self-asserted profile.");
    } catch (e: any) { setMsg('Error: ' + (e?.message || e)); }
    finally { setBusy(false); }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Card><CardContent>
        <Typography variant="h5" gutterBottom>🧳 Create your Traveler Wallet</Typography>
        <Typography color="text.secondary" paragraph>
          Your identity and keys are created and stored only in this browser (self-custody).
          We'll set you up with verified starter credentials so you can present to a supplier.
        </Typography>
        <Stack spacing={2}>
          <TextField label="Your name" value={name} onChange={(e) => setName(e.target.value)} autoFocus
            disabled={!!pending}
            onKeyDown={(e) => { if (e.key === 'Enter' && name.trim() && !busy) create(); }} />
          {!pending ? (
            <Box><Button variant="contained" size="large" onClick={create} disabled={!name.trim() || busy}>
              {busy ? 'Creating your wallet…' : 'Create my wallet'}
            </Button></Box>
          ) : (
            <Box><Button variant="contained" size="large" color="warning" onClick={() => onCreated(pending)}>
              Continue anyway →
            </Button></Box>
          )}
          {busy && <Typography variant="caption" color="text.secondary">Creating identity and receiving verified credentials…</Typography>}
          {msg && <Alert severity={pending ? 'warning' : 'error'}>{msg}</Alert>}
        </Stack>
      </CardContent></Card>
    </Container>
  );
}

function IdentityTab({ cfg, identity, onNewTraveler }: { cfg: AppConfig; identity: Identity; onNewTraveler: () => void }) {
  return (
    <Card><CardContent>
      <Typography variant="h6" gutterBottom>Self-sovereign identity</Typography>
      <Typography color="text.secondary" paragraph>
        Your keys live in this browser only. The Archon node at <code>{cfg.gatekeeperUrl}</code> is
        used purely as the public gatekeeper to resolve and anchor DIDs — it never holds your keys.
      </Typography>
      <Stack spacing={1}>
        <Field label="Name" value={identity.name} />
        <Field label="Your DID" value={identity.did} mono />
        <Field label="Registry" value={cfg.registry} />
      </Stack>
      <Divider sx={{ my: 2 }} />
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button variant="outlined" onClick={onNewTraveler}>Create another traveler</Button>
        <Button variant="outlined" color="error"
          onClick={() => { if (confirm('Clear this wallet and start fresh? The current identity will be removed from this browser.')) resetWallet(); }}>
          Start over (clear wallet)
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        “Start over” wipes this browser's wallet so the next person gets a clean slate — handy when
        passing one device around at a demo.
      </Typography>
    </CardContent></Card>
  );
}

function ProfileTab({ km, cfg, identity }: { km: Keymaster; cfg: AppConfig; identity: Identity }) {
  // Pre-fill Display name from the traveler's own identity name (not the sample).
  const [p, setP] = useState<HatproProfile>(() => ({
    ...sampleProfile,
    identity: { ...sampleProfile.identity, displayName: identity.name },
  }));
  const [diet, setDiet] = useState(csv(sampleProfile.foodAndBeverage.dietaryRestrictions));
  const [allergies, setAllergies] = useState(csv(sampleProfile.foodAndBeverage.allergies));
  const [cuisine, setCuisine] = useState(csv(sampleProfile.foodAndBeverage.cuisinePreferences));
  const [interests, setInterests] = useState(csv(sampleProfile.activities.interests));
  const [did, setDid] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const save = async () => {
    setBusy(true); setMsg('');
    try {
      const profile: HatproProfile = {
        ...p,
        identity: { ...p.identity, displayName: p.identity.displayName || identity.name },
        foodAndBeverage: { dietaryRestrictions: parseCsv(diet), allergies: parseCsv(allergies), cuisinePreferences: parseCsv(cuisine) },
        activities: { interests: parseCsv(interests) },
      };
      const vcDid = await saveProfileCredential(km, cfg, identity.did, profile);
      setDid(vcDid);
      setMsg('Profile self-issued as a credential (self-asserted) — ready to present to a supplier.');
    } catch (e: any) { setMsg('Error: ' + (e?.message || e)); } finally { setBusy(false); }
  };

  return (
    <Card><CardContent>
      <Typography variant="h6" gutterBottom>HATPro profile</Typography>
      <Typography color="text.secondary" paragraph>This is your own data. Saving self-issues it as a
        credential you can present — the supplier sees it as <em>self-asserted</em>.</Typography>
      <Stack spacing={2}>
        <TextField label="Display name" value={p.identity.displayName}
          onChange={(e) => setP({ ...p, identity: { ...p.identity, displayName: e.target.value } })} />
        <TextField label="Dietary restrictions (comma-separated)" value={diet} onChange={(e) => setDiet(e.target.value)} />
        <TextField label="Allergies (comma-separated)" value={allergies} onChange={(e) => setAllergies(e.target.value)} />
        <TextField label="Cuisine preferences (comma-separated)" value={cuisine} onChange={(e) => setCuisine(e.target.value)} />
        <TextField select label="Room floor" value={p.stayPreferences.roomFloor}
          onChange={(e) => setP({ ...p, stayPreferences: { ...p.stayPreferences, roomFloor: e.target.value } })}>
          {['high', 'low', 'no-preference'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
        </TextField>
        <FormControlLabel control={<Switch checked={p.stayPreferences.quietRoom}
          onChange={(e) => setP({ ...p, stayPreferences: { ...p.stayPreferences, quietRoom: e.target.checked } })} />} label="Quiet room" />
        <TextField label="Activity interests (comma-separated)" value={interests} onChange={(e) => setInterests(e.target.value)} />
        <Box><Button variant="contained" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</Button></Box>
        {msg && <Alert severity={msg.startsWith('Error') ? 'error' : 'success'}>{msg}</Alert>}
        {did && <Field label="Profile credential DID" value={did} mono />}
      </Stack>
    </CardContent></Card>
  );
}

function CredentialsTab({ km }: { km: Keymaster }) {
  const [held, setHeld] = useState<{ did: string; vc: any }[]>([]);

  useEffect(() => {
    (async () => {
      const dids: string[] = await km.listCredentials();
      setHeld(await Promise.all(dids.map(async (d) => ({ did: d, vc: await km.getCredential(d).catch(() => null) }))));
    })();
  }, []);

  return (
    <Stack spacing={2}>
      {held.length === 0 && <Typography color="text.secondary">No credentials held yet.</Typography>}
      {held.map(({ did, vc }) => (
        <Card key={did}><CardContent>
          <Typography variant="subtitle1">{vc?.type?.join(', ') || 'Credential'}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="body2" color="text.secondary">issuer: {short(vc?.issuer || '')}</Typography>
            {vc?.issuer && <ResolveLink did={vc.issuer} />}
          </Box>
          <Divider sx={{ my: 1 }} />
          {vc?.credentialSubject && <JsonView value={vc.credentialSubject} collapsed={1} displayDataTypes={false} />}
          <Field label="VC DID" value={did} mono />
        </CardContent></Card>
      ))}
    </Stack>
  );
}

function AliasesTab({ km, cfg }: { km: Keymaster; cfg: AppConfig }) {
  const [list, setList] = useState<AliasEntry[]>([]);
  const [alias, setAlias] = useState('');
  const [did, setDid] = useState('');
  const [msg, setMsg] = useState('');

  const refresh = async () => setList((await loadAliases(km, cfg)).list);
  useEffect(() => { refresh(); }, []);

  const add = async () => {
    setMsg('');
    try { await km.addAlias(alias.trim(), did.trim()); setAlias(''); setDid(''); await refresh(); }
    catch (e: any) { setMsg('Error: ' + (e?.message || e)); }
  };
  const remove = async (a: string) => { try { await km.removeAlias(a); await refresh(); } catch (e: any) { setMsg('Error: ' + (e?.message || e)); } };

  const color = (t: AliasEntry['type']) => (t === 'Organization' ? 'primary' : t === 'Schema' ? 'secondary' : 'default');

  return (
    <Card><CardContent>
      <Typography variant="h6" gutterBottom>Address book</Typography>
      <Typography color="text.secondary" paragraph>
        Human-friendly names for the organizations and credential schemas you know. Used to make
        profile requests readable.
      </Typography>
      <List dense>
        {list.map((e) => (
          <ListItem key={e.alias} divider
            secondaryAction={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Link component="button" variant="caption" onClick={() => navigator.clipboard.writeText(e.did)}>copy DID</Link>
                <ResolveLink did={e.did} />
                <IconButton edge="end" size="small" onClick={() => remove(e.alias)} aria-label="remove">✕</IconButton>
              </Box>
            }>
            <ListItemText
              primary={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>{e.alias}</span><Chip size="small" label={e.type} color={color(e.type) as any} variant="outlined" />
              </Box>}
              secondary={<span style={{ fontFamily: 'monospace', fontSize: 12 }}>{e.did}</span>} />
          </ListItem>
        ))}
        {list.length === 0 && <Typography color="text.secondary">No aliases yet.</Typography>}
      </List>
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" gutterBottom>Add an alias</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="flex-start">
        <TextField size="small" label="Friendly name" value={alias} onChange={(e) => setAlias(e.target.value)} />
        <TextField size="small" label="DID" value={did} onChange={(e) => setDid(e.target.value)} sx={{ flexGrow: 1, minWidth: 240 }} />
        <Button variant="contained" onClick={add} disabled={!alias || !did}>Add</Button>
      </Stack>
      {msg && <Alert severity="error" sx={{ mt: 2 }}>{msg}</Alert>}
    </CardContent></Card>
  );
}

function RequestsTab({ km, cfg }: { km: Keymaster; cfg: AppConfig }) {
  const [challenge, setChallenge] = useState('');
  const [requested, setRequested] = useState<any>(null);
  const [byDid, setByDid] = useState<Record<string, string>>({});
  const [showRaw, setShowRaw] = useState(false);
  const [response, setResponse] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const [held, setHeld] = useState<Set<string>>(new Set());
  useEffect(() => { loadAliases(km, cfg).then((a) => setByDid(a.byDid)); heldSchemas(km).then(setHeld); }, []);
  const name = (d: string) => byDid[d] || `${d.slice(0, 14)}…${d.slice(-6)}`;

  const review = async () => {
    setMsg(''); setRequested(null); setResponse('');
    try { const doc = await km.resolveDID(challenge.trim()); setRequested((doc as any).didDocumentData ?? doc); }
    catch (e: any) { setMsg('Error: ' + (e?.message || e)); }
  };
  const present = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await km.createResponse(challenge.trim(), { registry: cfg.registry, retries: 10 } as any);
      setResponse(r); setMsg('Presentation created. Hand this response DID back to the supplier.');
    } catch (e: any) { setMsg('Error: ' + (e?.message || e)); } finally { setBusy(false); }
  };

  const creds: any[] = requested?.challenge?.credentials ?? [];
  const missing = creds.filter((c) => c.schema && !held.has(c.schema));
  const profileMissing = missing.some((c) => c.schema === cfg.schemas.hatproProfile);

  return (
    <Card><CardContent>
      <Typography variant="h6" gutterBottom>Respond to a profile request</Typography>
      <Typography color="text.secondary" paragraph>
        Paste the supplier's profile-request (challenge) DID. You'll see exactly what's being asked
        before you consent — only the credentials you choose to present are shared.
      </Typography>
      <Stack spacing={2}>
        <TextField label="Challenge DID" value={challenge} onChange={(e) => setChallenge(e.target.value)} fullWidth />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" onClick={review} disabled={!challenge}>Review request</Button>
          <Button variant="contained" onClick={present} disabled={!challenge || busy}>{busy ? 'Presenting…' : 'Consent & present'}</Button>
        </Box>
        {requested && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>This supplier is requesting:</Typography>
            {creds.length > 0 ? (
              <List dense sx={{ bgcolor: 'action.hover', borderRadius: 1 }}>
                {creds.map((c, i) => {
                  const have = held.has(c.schema);
                  return (
                    <ListItem key={i} secondaryAction={
                      <Chip size="small" color={have ? 'success' : 'default'} variant={have ? 'filled' : 'outlined'}
                        label={have ? '✓ held' : 'not held'} />
                    }>
                      <ListItemText primary={name(c.schema)}
                        secondary={c.issuers?.length ? `issued by ${c.issuers.map(name).join(', ')}` : 'any issuer (self-asserted allowed)'} />
                    </ListItem>
                  );
                })}
              </List>
            ) : <Alert severity="info">Could not parse the request structure — see raw below.</Alert>}
            {missing.length > 0 && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                You don't yet hold {missing.map((c) => name(c.schema)).join(', ')}. The presentation will be
                incomplete and the supplier won't accept it.
                {profileMissing && ' Save your profile in the Profile tab first.'}
              </Alert>
            )}
            <Link component="button" variant="caption" onClick={() => setShowRaw(!showRaw)} sx={{ mt: 1 }}>
              {showRaw ? 'hide raw JSON' : 'show raw JSON'}
            </Link>
            <Collapse in={showRaw}><Box sx={{ mt: 1 }}><JsonView value={requested} collapsed={2} displayDataTypes={false} /></Box></Collapse>
          </Box>
        )}
        {msg && <Alert severity={msg.startsWith('Error') ? 'error' : 'success'}>{msg}</Alert>}
        {response && <Field label="Response DID (give to supplier)" value={response} mono copy />}
      </Stack>
    </CardContent></Card>
  );
}

function Field({ label, value, mono, copy }: { label: string; value: string; mono?: boolean; copy?: boolean }) {
  const isDid = value.startsWith('did:');
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontFamily: mono ? 'monospace' : undefined, fontSize: mono ? 13 : undefined, wordBreak: 'break-all' }}>{value}</Typography>
        {copy && <Link component="button" variant="caption" onClick={() => navigator.clipboard.writeText(value)}>copy</Link>}
        {isDid && <ResolveLink did={value} />}
      </Box>
    </Box>
  );
}
