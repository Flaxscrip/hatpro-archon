// In-app DID resolver: resolves a did:cid and formats the document for demo & discussion.
// Shown as a "Resolver" tab; the resolve-icon next to any DID brings that DID here.
// `resolveDid` is supplied by each app — keymaster.resolveDID in the wallet, or an HTTP
// gatekeeper fetch in the apps that don't run keymaster.
import { useEffect, useState } from 'react';
import {
  Card, CardContent, Typography, Box, Stack, Chip, TextField, Button, Alert, Link, Collapse,
} from '@mui/material';
import JsonView from '@uiw/react-json-view';

function KV({ k, v, mono }: { k: string; v: any; mono?: boolean }) {
  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 110 }}>{k}</Typography>
      <Typography variant="body2" sx={{ fontFamily: mono ? 'monospace' : undefined, fontSize: mono ? 12 : undefined, wordBreak: 'break-all' }}>{v}</Typography>
    </Box>
  );
}

export function DidResolver({ resolveDid, target, onResolve }: {
  resolveDid: (did: string) => Promise<any>;
  target: string | null;
  onResolve: (did: string) => void;
}) {
  const [did, setDid] = useState(target || '');
  const [doc, setDoc] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [showRaw, setShowRaw] = useState(false);

  const resolve = async (d: string) => {
    const t = (d || '').trim();
    if (!t.startsWith('did:')) { setErr('Enter a valid did:cid identifier.'); setDoc(null); return; }
    setBusy(true); setErr(''); setDoc(null);
    try { setDid(t); setDoc(await resolveDid(t)); }
    catch (e: any) { setErr('Could not resolve: ' + (e?.message || e)); }
    finally { setBusy(false); }
  };

  // Auto-resolve when a DID is pushed in from a resolve-icon elsewhere in the wallet.
  useEffect(() => { if (target) resolve(target); }, [target]);

  const dd = doc?.didDocument, meta = doc?.didDocumentMetadata, reg = doc?.didDocumentRegistration, data = doc?.didDocumentData;
  const type = reg?.type || (dd?.verificationMethod ? 'agent' : 'asset');

  return (
    <Card><CardContent>
      <Typography variant="h6" gutterBottom>DID Resolver</Typography>
      <Typography color="text.secondary" paragraph>
        Resolve any <code>did:cid</code> and inspect its document, metadata, and data. Click the resolve
        icon next to a DID anywhere in the wallet to bring it here.
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <TextField size="small" fullWidth label="DID" value={did} spellCheck={false}
          onChange={(e) => setDid(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') resolve(did); }} />
        <Button variant="contained" onClick={() => resolve(did)} disabled={busy}>{busy ? '…' : 'Resolve'}</Button>
      </Stack>
      {err && <Alert severity="error">{err}</Alert>}
      {doc && (
        <Box>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
            <Chip size="small" color={type === 'agent' ? 'primary' : 'secondary'}
              label={type === 'agent' ? '🔑 Agent (key-holder)' : '📄 Asset (controlled)'} />
            {reg?.registry && <Chip size="small" variant="outlined" label={`registry: ${reg.registry}`} />}
            {meta?.versionSequence && <Chip size="small" variant="outlined" label={`version ${meta.versionSequence}`} />}
            <Chip size="small" color={meta?.confirmed ? 'success' : 'warning'} variant={meta?.confirmed ? 'filled' : 'outlined'}
              label={meta?.confirmed ? '✓ confirmed' : 'unconfirmed'} />
            {meta?.deactivated && <Chip size="small" color="error" label="⊘ revoked" />}
          </Stack>
          <Stack spacing={0.5} sx={{ mb: 1.5 }}>
            <KV k="DID" v={dd?.id} mono />
            {dd?.controller && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 110 }}>Controller</Typography>
                <Link component="button" onClick={() => onResolve(dd.controller)}
                  sx={{ fontFamily: 'monospace', fontSize: 12, textAlign: 'left', wordBreak: 'break-all' }}>{dd.controller}</Link>
              </Box>
            )}
            {meta?.created && <KV k="Created" v={meta.created} />}
            {meta?.updated && meta.updated !== meta.created && <KV k="Updated" v={meta.updated} />}
          </Stack>

          {dd?.verificationMethod?.length > 0 && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="subtitle2">Verification methods (keys)</Typography>
              {dd.verificationMethod.map((vm: any) => (
                <Typography key={vm.id} variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
                  {vm.id} · {vm.type}{vm.publicKeyJwk?.crv ? ` · ${vm.publicKeyJwk.crv}` : ''}
                </Typography>
              ))}
            </Box>
          )}
          {dd?.service?.length > 0 && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="subtitle2">Services</Typography>
              {dd.service.map((s: any, i: number) => (
                <Typography key={i} variant="body2" sx={{ fontSize: 12, wordBreak: 'break-all' }}>{s.type}: {s.serviceEndpoint}</Typography>
              ))}
            </Box>
          )}

          <Typography variant="subtitle2">Document data <Typography component="span" variant="caption" color="text.secondary">— the substantive payload</Typography></Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Archon stores application data here: a credential's contents, a group's members, or — for a
            traveler profile — the HATPro data itself. Signed by the controller and versioned with the DID.
          </Typography>
          {data && Object.keys(data).length
            ? <JsonView value={data} collapsed={2} displayDataTypes={false} />
            : <Typography variant="body2" color="text.secondary">(empty)</Typography>}

          <Link component="button" variant="caption" sx={{ mt: 1, display: 'inline-block' }} onClick={() => setShowRaw(!showRaw)}>
            {showRaw ? 'hide raw document' : 'show raw document'}
          </Link>
          <Collapse in={showRaw}><Box sx={{ mt: 1 }}><JsonView value={doc} collapsed={2} displayDataTypes={false} /></Box></Collapse>
        </Box>
      )}
    </CardContent></Card>
  );
}
