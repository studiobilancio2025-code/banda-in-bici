// La banda in bici — funzione "strava" (Supabase → Edge Functions). Parla con Strava al posto dell'app,
// così la chiave segreta di Strava non finisce mai nelle pagine pubbliche.
// Segreti da impostare in Supabase (Edge Functions → Secrets): STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const J = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const serviceKey = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || (() => { try { return Object.values(JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}'))[0] as string; } catch { return ''; } })();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey());
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
    const { data: { user }, error } = await admin.auth.getUser(jwt);
    if (error || !user) return J({ error: 'Prima entra nella banda (account).' }, 401);
    const body = await req.json().catch(() => ({}));
    const op = body.op, CID = Deno.env.get('STRAVA_CLIENT_ID'), SEC = Deno.env.get('STRAVA_CLIENT_SECRET');
    if (!CID || !SEC) return J({ error: 'Mancano STRAVA_CLIENT_ID e STRAVA_CLIENT_SECRET nei segreti di Supabase.' }, 500);
    const token = async (p: Record<string, string>) => {
      const r = await fetch('https://www.strava.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: CID, client_secret: SEC, ...p }) });
      const t = await r.json(); if (!r.ok) throw new Error(t.message || 'Strava ha rifiutato'); return t;
    };
    if (op === 'exchange') {
      const t = await token({ code: String(body.code || ''), grant_type: 'authorization_code' });
      const a = t.athlete ? { id: t.athlete.id, nome: `${t.athlete.firstname || ''} ${t.athlete.lastname || ''}`.trim() } : null;
      const { error: e1 } = await admin.from('strava').upsert({ user_id: user.id, athlete: a, access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at, updated_at: new Date().toISOString() });
      if (e1) return J({ error: 'Strava ha risposto, ma non riesco a salvare le chiavi: ' + e1.message }, 500);
      return J({ ok: true, athlete: a });
    }
    const { data: row, error: e2 } = await admin.from('strava').select('*').eq('user_id', user.id).maybeSingle();
    if (e2) return J({ error: 'Non riesco a leggere il collegamento: ' + e2.message }, 500);
    if (op === 'status') return J({ connected: !!row, athlete: row?.athlete || null });
    if (!row) return J({ error: 'Strava non è collegato.' }, 400);
    let tok = row.access_token;
    if (row.expires_at < Date.now() / 1000 + 120) {
      const t = await token({ refresh_token: row.refresh_token, grant_type: 'refresh_token' });
      await admin.from('strava').update({ access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at, updated_at: new Date().toISOString() }).eq('user_id', user.id);
      tok = t.access_token;
    }
    const api = async (p: string) => { const r = await fetch('https://www.strava.com/api/v3' + p, { headers: { Authorization: 'Bearer ' + tok } }); const d = await r.json(); if (!r.ok) throw new Error(d.message || 'Strava ' + r.status); return d; };
    if (op === 'activities') {
      const d = await api(`/athlete/activities?per_page=30&page=${Math.max(1, Number(body.page) || 1)}`);
      return J(d.map((a: any) => ({ id: String(a.id), nome: a.name, start: a.start_date, locale: a.start_date_local, km: a.distance / 1000, dplus: a.total_elevation_gain, durata: a.elapsed_time, tipo: a.sport_type })));
    }
    if (op === 'activity') {
      const id = String(body.id || '').replace(/\D/g, '');
      const a = await api(`/activities/${id}?include_all_efforts=true`);
      const s = await api(`/activities/${id}/streams?keys=time,latlng,altitude,heartrate,cadence,watts&key_by_type=true`);
      return J({ id, nome: a.name, start: a.start_date, locale: a.start_date_local, km: a.distance / 1000, dplus: a.total_elevation_gain, durata: a.elapsed_time,
        segs: (a.segment_efforts || []).map((e: any) => ({ sid: String(e.segment?.id), nome: e.segment?.name || e.name, km: (e.segment?.distance || e.distance) / 1000, a: e.segment?.start_latlng, b: e.segment?.end_latlng, i0: e.start_index, i1: e.end_index, tempo: e.elapsed_time })),
        st: { t: s.time?.data, ll: s.latlng?.data, el: s.altitude?.data, hr: s.heartrate?.data, cad: s.cadence?.data, pw: s.watts?.data } });
    }
    if (op === 'disconnect') {
      try { await fetch('https://www.strava.com/oauth/deauthorize', { method: 'POST', headers: { Authorization: 'Bearer ' + tok } }); } catch (_) { /* già scollegato */ }
      await admin.from('strava').delete().eq('user_id', user.id);
      return J({ ok: true });
    }
    return J({ error: 'Operazione sconosciuta' }, 400);
  } catch (e) { return J({ error: String((e as Error).message || e) }, 500); }
});
