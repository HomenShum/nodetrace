create table if not exists trace_sessions (
  id text primary key,
  title text not null,
  status text not null,
  summary text not null,
  created_at text not null
);

create table if not exists trace_surfaces (
  id text primary key,
  label text not null,
  proof_available integer not null default 0,
  about text not null
);

create table if not exists trace_proofs (
  id text primary key,
  session_id text not null references trace_sessions(id) on delete cascade,
  surface_id text not null references trace_surfaces(id) on delete cascade,
  artifact_id text,
  element_id text,
  title text not null,
  status text not null,
  confidence real not null,
  source_label text not null,
  source_url text,
  detail text not null,
  created_at text not null
);

create table if not exists trace_events (
  id text primary key,
  session_id text not null references trace_sessions(id) on delete cascade,
  surface_id text not null references trace_surfaces(id) on delete cascade,
  artifact_id text,
  element_id text,
  phase text not null,
  actor text not null,
  status text not null,
  summary text not null,
  duration_ms integer not null,
  created_at text not null
);

create table if not exists trace_code_ownership (
  id text primary key,
  surface_id text not null references trace_surfaces(id) on delete cascade,
  owner_label text not null,
  component_ref text not null,
  backend_ref text not null,
  test_ref text not null,
  builder_only integer not null default 1,
  created_at text not null
);
