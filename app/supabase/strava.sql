-- La banda in bici: collegamento a Strava. Da incollare in Supabase → SQL Editor → Run (una volta).
-- Qui si conservano le chiavi che Strava dà a ciascun ciclista quando collega il suo account.
-- Nessuna regola di accesso: le può leggere SOLO la funzione "strava" (chiave di servizio), mai l'app.
create table if not exists strava (
  user_id uuid primary key references auth.users on delete cascade,
  athlete jsonb,
  access_token text,
  refresh_token text,
  expires_at bigint,
  updated_at timestamptz not null default now()
);
alter table strava enable row level security;
revoke all on strava from anon, authenticated;
grant all on strava to service_role;   -- la funzione "strava" (chiave di servizio) deve poterla leggere e scrivere
