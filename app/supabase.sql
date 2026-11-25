-- La banda in bici: archivio online (Supabase). Da incollare UNA volta in Supabase → SQL Editor → Run.
-- Chi si registra per primo diventa amministratore (approva gli altri). Gli altri vedono le cose
-- "pubbliche" della banda solo dopo l'approvazione. Le tracce complete restano visibili solo a chi le ha caricate:
-- agli altri arriva una copia senza i primi e gli ultimi 600 m (niente case).

create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  nome text not null default '',
  dati jsonb not null default '{}'::jsonb,      -- soprannome, colore, altezza, fisico, battute, foto (testa, intera, bici)
  membro boolean not null default false,
  admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists guardaroba (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  tipo text not null check (tipo in ('completino','casco','bici')),
  nome text not null default '',
  dati jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists uscite (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  data date not null,
  titolo text not null default '',
  pubblica boolean not null default false,
  info jsonb not null default '{}'::jsonb,       -- km, dislivello, durata, ora di partenza, completino/casco/bici usati
  traccia_pub text,                              -- copia senza partenza e arrivo, per gli altri (solo se pubblica)
  created_at timestamptz not null default now()
);

create table if not exists tracce (
  uscita_id uuid primary key references uscite on delete cascade,
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  dati text not null                              -- traccia completa compressa: la vede solo chi l'ha caricata
);

create table if not exists segmenti (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null default '',
  pubblico boolean not null default false,
  a jsonb not null, b jsonb not null,             -- [lat, lon] di partenza e arrivo
  info jsonb not null default '{}'::jsonb,        -- lunghezza, dislivello
  created_at timestamptz not null default now()
);

create table if not exists passaggi (
  id uuid primary key default gen_random_uuid(),
  segmento_id uuid not null references segmenti on delete cascade,
  uscita_id uuid not null references uscite on delete cascade,
  owner uuid not null references auth.users on delete cascade,   -- il ciclista dell'uscita
  data date not null,
  ta real not null, tb real not null, durata real not null,      -- secondi dall'inizio della traccia
  created_at timestamptz not null default now(),
  unique (segmento_id, uscita_id)
);

-- chi è membro della banda (approvato)
create or replace function is_membro() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select membro from profiles where id = auth.uid()), false) $$;
create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select admin from profiles where id = auth.uid()), false) $$;

-- alla registrazione nasce il profilo; il primo in assoluto è amministratore e membro
create or replace function nuovo_profilo() returns trigger language plpgsql security definer set search_path = public as
$$ declare primo boolean; begin
  select not exists(select 1 from profiles) into primo;
  insert into profiles(id, nome, membro, admin) values (new.id, coalesce(new.raw_user_meta_data->>'nome', ''), primo, primo)
  on conflict (id) do nothing;
  return new; end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function nuovo_profilo();

-- l'amministratore approva (o toglie) un ciclista
create or replace function approva(uid uuid, si boolean) returns void language plpgsql security definer set search_path = public as
$$ begin if not is_admin() then raise exception 'solo l''amministratore'; end if;
  update profiles set membro = si where id = uid; end $$;

alter table profiles enable row level security;
alter table guardaroba enable row level security;
alter table uscite enable row level security;
alter table tracce enable row level security;
alter table segmenti enable row level security;
alter table passaggi enable row level security;

-- profili: ognuno vede il proprio; i membri vedono tutti (l'amministratore anche chi aspetta l'approvazione)
drop policy if exists p_sel on profiles;  create policy p_sel on profiles for select using (id = auth.uid() or is_membro());
drop policy if exists p_upd on profiles;  create policy p_upd on profiles for update using (id = auth.uid()) with check (id = auth.uid());
revoke update on profiles from authenticated, anon;
grant update (nome, dati) on profiles to authenticated;

drop policy if exists g_all on guardaroba; create policy g_all on guardaroba for all using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists u_sel on uscite; create policy u_sel on uscite for select using (owner = auth.uid() or (pubblica and is_membro()));
drop policy if exists u_ins on uscite; create policy u_ins on uscite for insert with check (owner = auth.uid());
drop policy if exists u_upd on uscite; create policy u_upd on uscite for update using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists u_del on uscite; create policy u_del on uscite for delete using (owner = auth.uid());

drop policy if exists t_all on tracce; create policy t_all on tracce for all using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists s_sel on segmenti; create policy s_sel on segmenti for select using (owner = auth.uid() or (pubblico and is_membro()));
drop policy if exists s_ins on segmenti; create policy s_ins on segmenti for insert with check (owner = auth.uid());
drop policy if exists s_upd on segmenti; create policy s_upd on segmenti for update using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists s_del on segmenti; create policy s_del on segmenti for delete using (owner = auth.uid());

-- passaggi: si vedono se si vede l'uscita; li può aggiungere chi vede sia l'uscita sia il segmento
drop policy if exists x_sel on passaggi; create policy x_sel on passaggi for select using (
  exists (select 1 from uscite u where u.id = uscita_id and (u.owner = auth.uid() or (u.pubblica and is_membro()))));
drop policy if exists x_ins on passaggi; create policy x_ins on passaggi for insert with check (
  exists (select 1 from uscite u where u.id = uscita_id and u.owner = owner and (u.owner = auth.uid() or (u.pubblica and is_membro())))
  and exists (select 1 from segmenti s where s.id = segmento_id and (s.owner = auth.uid() or (s.pubblico and is_membro()))));
drop policy if exists x_del on passaggi; create policy x_del on passaggi for delete using (
  owner = auth.uid() or exists (select 1 from segmenti s where s.id = segmento_id and s.owner = auth.uid()));

create index if not exists uscite_data on uscite(data);
create index if not exists passaggi_seg on passaggi(segmento_id);
