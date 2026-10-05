begin;
create table public.document_checkpoints(
 id uuid primary key,file_id uuid not null references public.files on delete cascade,generation integer not null,server_seq bigint not null,
 storage_key text not null unique,checksum text not null,label text not null,size_bytes bigint not null check(size_bytes between 1 and 8388608),
 created_at timestamptz not null default now()
);
alter table public.document_checkpoints enable row level security;
create policy checkpoint_read on public.document_checkpoints for select to authenticated using(exists(select 1 from public.files f where f.id=file_id and public.project_role(f.project_id) is not null));
revoke all on public.document_checkpoints from anon,authenticated;
grant select on public.document_checkpoints to authenticated;
-- Trusted room backup job publishes pointers after private immutable uploads.
grant all on public.document_checkpoints to service_role;
insert into storage.buckets(id,name,public,file_size_limit) values('ultrapad-checkpoints','ultrapad-checkpoints',false,8388608) on conflict(id) do nothing;
-- Browser has no direct write/delete grant for this bucket. Read is scoped through its published checkpoint row.
create policy checkpoint_object_read on storage.objects for select to authenticated using(bucket_id='ultrapad-checkpoints' and exists(select 1 from public.document_checkpoints c join public.files f on f.id=c.file_id where c.storage_key=storage.objects.name and public.project_role(f.project_id) is not null));
commit;
