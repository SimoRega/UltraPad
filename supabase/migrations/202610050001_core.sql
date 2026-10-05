begin;
create extension if not exists pgcrypto with schema extensions;
create type public.app_role as enum ('viewer','commenter','editor','admin','owner');
create table public.workspaces(id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 120),owner_id uuid not null references auth.users,acl_version bigint not null default 1,created_at timestamptz not null default now());
create table public.workspace_members(workspace_id uuid references public.workspaces on delete cascade,user_id uuid references auth.users on delete cascade,role public.app_role not null,primary key(workspace_id,user_id));
create table public.projects(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces on delete cascade,name text not null check(length(name) between 1 and 120),created_by uuid not null references auth.users,created_at timestamptz not null default now(),unique(id,workspace_id));
create table public.project_members(project_id uuid,workspace_id uuid not null,user_id uuid,role public.app_role not null check(role<>'owner'),primary key(project_id,user_id),foreign key(project_id,workspace_id) references public.projects(id,workspace_id) on delete cascade,foreign key(workspace_id,user_id) references public.workspace_members on delete cascade);
create table public.files(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,project_id uuid not null,parent_id uuid,
 name text not null check(length(name) between 1 and 120 and name not in ('.','..') and name !~ '[\\/[:cntrl:]]'),name_key text generated always as(lower(name)) stored,
 kind text not null check(kind in ('text','folder')),language text not null default 'plaintext',generation integer not null default 1 check(generation>0),metadata_version bigint not null default 1,schema_version integer not null default 1,
 status text not null default 'ready' check(status in ('ready','restoring')),restore_id uuid,restore_checkpoint uuid,pending_generation integer,created_at timestamptz not null default now(),
 unique(id,project_id,workspace_id),foreign key(project_id,workspace_id) references public.projects(id,workspace_id) on delete cascade,
 foreign key(parent_id,project_id,workspace_id) references public.files(id,project_id,workspace_id) on delete cascade);
create unique index files_names on public.files(project_id,coalesce(parent_id,'00000000-0000-0000-0000-000000000000'::uuid),name_key);
create index files_project on public.files(project_id);
create table public.invitations(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects on delete cascade,role public.app_role not null check(role<>'owner'),email_key text not null,token_hash text not null unique,expires_at timestamptz not null default now()+interval '72 hours',used_at timestamptz,created_by uuid not null references auth.users);
create table public.acl_outbox(id bigint generated always as identity primary key,project_id uuid not null,created_at timestamptz not null default now(),delivered_at timestamptz);
create function public.project_role(pid uuid) returns public.app_role language sql stable security definer set search_path='' as $$
 select case when w.owner_id=auth.uid() then 'owner'::public.app_role when m.role>='admin'::public.app_role then m.role else least(m.role,pm.role) end
 from public.projects p join public.workspaces w on w.id=p.workspace_id join public.workspace_members m on m.workspace_id=w.id and m.user_id=auth.uid()
 left join public.project_members pm on pm.project_id=p.id and pm.user_id=auth.uid()
 where p.id=pid and(w.owner_id=auth.uid() or m.role>='admin'::public.app_role or pm.user_id is not null)
$$;
create function public.workspace_role(wid uuid) returns public.app_role language sql stable security definer set search_path='' as $$
 select case when w.owner_id=auth.uid() then 'owner'::public.app_role else m.role end from public.workspaces w join public.workspace_members m on m.workspace_id=w.id and m.user_id=auth.uid() where w.id=wid
$$;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.files enable row level security;
alter table public.invitations enable row level security;
alter table public.acl_outbox enable row level security;
create policy read_workspace on public.workspaces for select to authenticated using(public.workspace_role(id) is not null);
create policy read_workspace_members on public.workspace_members for select to authenticated using(user_id=auth.uid() or public.workspace_role(workspace_id)>='admin');
create policy read_projects on public.projects for select to authenticated using(public.project_role(id) is not null);
create policy read_project_members on public.project_members for select to authenticated using(public.project_role(project_id) is not null);
create policy read_files on public.files for select to authenticated using(public.project_role(project_id) is not null);
revoke all on public.workspaces,public.workspace_members,public.projects,public.project_members,public.files,public.invitations,public.acl_outbox from anon,authenticated;
grant select on public.workspaces,public.workspace_members,public.projects,public.project_members,public.files to authenticated;
create function public.valid_name(n text) returns text language plpgsql immutable set search_path='' as $$
begin n:=normalize(trim(n),NFC); if n is null or length(n) not between 1 and 120 or n in ('.','..') or n ~ '[\\/[:cntrl:]]' then raise exception 'INVALID_NAME'; end if; return n; end $$;
create function public.mutate(op text,args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); wid uuid; pid uuid; fid uuid; par uuid; r public.app_role; f public.files; w public.workspaces; result jsonb; member uuid; target public.app_role; inv public.invitations; verified_email text;
begin
 if uid is null then raise exception 'UNAUTHORIZED'; end if;
 if op='create_workspace' then
 insert into public.workspaces(name,owner_id) values(public.valid_name(args->>'name'),uid) returning * into w;
 insert into public.workspace_members values(w.id,uid,'owner'); return to_jsonb(w); end if;
 if op='delete_workspace' then delete from public.workspaces where id=(args->>'id')::uuid and owner_id=uid; if not found then raise exception 'FORBIDDEN'; end if; return '{}'; end if;
 if op='create_project' then
 wid:=(args->>'workspace_id')::uuid; if not coalesce(public.workspace_role(wid)>='editor',false) then raise exception 'FORBIDDEN'; end if;
 insert into public.projects(workspace_id,name,created_by) values(wid,public.valid_name(args->>'name'),uid) returning id into pid;
 if public.workspace_role(wid)<'admin' then insert into public.project_members values(pid,wid,uid,'editor'); end if; return jsonb_build_object('id',pid); end if;
 if op='accept_invite' then
 select * into inv from public.invitations where token_hash=args->>'token_hash' for update;
 if not found or inv.used_at is not null or inv.expires_at<now() then raise exception 'INVALID_INVITATION'; end if;
 select lower(email) into verified_email from auth.users where id=uid and email_confirmed_at is not null;
 if verified_email is null or verified_email<>inv.email_key then raise exception 'INVITATION_IDENTITY'; end if;
 select workspace_id into wid from public.projects where id=inv.project_id;
 insert into public.workspace_members values(wid,uid,inv.role) on conflict(workspace_id,user_id) do update set role=greatest(public.workspace_members.role,excluded.role);
 insert into public.project_members values(inv.project_id,wid,uid,inv.role) on conflict(project_id,user_id) do update set role=excluded.role;
 update public.invitations set used_at=now() where id=inv.id; return jsonb_build_object('project_id',inv.project_id); end if;
 if op in ('rename_file','move_file','delete_file','begin_restore','finish_restore') then
 fid:=(args->>'id')::uuid; select * into f from public.files where id=fid for update; if not found then raise exception 'NOT_FOUND'; end if; pid:=f.project_id;
 else pid:=(args->>'project_id')::uuid; end if;
 r:=public.project_role(pid); if r is null then raise exception 'FORBIDDEN'; end if;
 select workspace_id into wid from public.projects where id=pid;
 if op='create_invite' then
 target:=(args->>'role')::public.app_role;
 if target is null or r<'admin' or target='owner' or(r<>'owner' and target>='admin') then raise exception 'FORBIDDEN'; end if;
 if args->>'email' is null or position('@' in args->>'email')<2 or length(args->>'email')>254 then raise exception 'INVALID_EMAIL'; end if;
 insert into public.invitations(project_id,role,email_key,token_hash,created_by) values(pid,target,lower(trim(args->>'email')),args->>'token_hash',uid) returning jsonb_build_object('id',id,'expires_at',expires_at) into result; return result; end if;
 if op='set_member' then
 member:=(args->>'user_id')::uuid; target:=(args->>'role')::public.app_role;
 if r<'admin' or member=uid or member=(select owner_id from public.workspaces where id=wid) or target='owner' or
 (r<>'owner' and(target>='admin' or exists(select 1 from public.project_members where project_id=pid and user_id=member and role>='admin') or exists(select 1 from public.workspace_members where workspace_id=wid and user_id=member and role>='admin'))) then raise exception 'FORBIDDEN'; end if;
 if exists(select 1 from public.workspace_members where workspace_id=wid and user_id=member and role>='admin') then raise exception 'WORKSPACE_ADMIN_USE_OWNER'; end if;
 if target is null then delete from public.project_members where project_id=pid and user_id=member;
 else update public.workspace_members set role=greatest(role,target) where workspace_id=wid and user_id=member;
 insert into public.project_members values(pid,wid,member,target) on conflict(project_id,user_id) do update set role=excluded.role; end if;
 update public.workspaces set acl_version=acl_version+1 where id=wid; insert into public.acl_outbox(project_id) values(pid); return '{}'; end if;
 if op='delete_project' then if r<'admin' then raise exception 'FORBIDDEN'; end if; delete from public.projects where id=pid; return '{}'; end if;
 if op in ('begin_restore','finish_restore') then
 if r<'admin' then raise exception 'FORBIDDEN'; end if;
 if op='begin_restore' then
 if f.status='ready' and f.restore_id=(args->>'operation_id')::uuid then return to_jsonb(f); end if;
 if f.status='restoring' and f.restore_id=(args->>'operation_id')::uuid and f.restore_checkpoint is distinct from (args->>'checkpoint_id')::uuid then raise exception 'RESTORE_CONFLICT'; end if;
 if f.status='restoring' and f.restore_id is distinct from (args->>'operation_id')::uuid then raise exception 'RESTORE_IN_PROGRESS'; end if;
 update public.files set status='restoring',restore_id=(args->>'operation_id')::uuid,restore_checkpoint=(args->>'checkpoint_id')::uuid,pending_generation=generation+1 where id=fid;
 else
 if f.status='ready' and f.restore_id=(args->>'operation_id')::uuid then return to_jsonb(f); end if;
 if f.restore_id is distinct from (args->>'operation_id')::uuid or f.status<>'restoring' then raise exception 'RESTORE_CONFLICT'; end if;
 update public.files set status='ready',generation=pending_generation,pending_generation=null,metadata_version=metadata_version+1 where id=fid; end if;
 select to_jsonb(public.files.*) into result from public.files where id=fid; return result; end if;
 if r<'editor' then raise exception 'FORBIDDEN'; end if;
 if fid is not null and f.status<>'ready' then raise exception 'RESTORE_IN_PROGRESS'; end if;
 if op='create_file' then
 perform pg_advisory_xact_lock(hashtextextended(pid::text,0)); if(select count(*) from public.files where project_id=pid)>=500 then raise exception 'FILE_QUOTA'; end if;
 par:=(args->>'parent_id')::uuid; if par is not null and not exists(select 1 from public.files where id=par and project_id=pid and kind='folder') then raise exception 'INVALID_PARENT'; end if;
 insert into public.files(workspace_id,project_id,parent_id,name,kind,language) values(wid,pid,par,public.valid_name(args->>'name'),args->>'kind',coalesce(args->>'language','plaintext')) returning to_jsonb(public.files.*) into result; return result; end if;
 if op in ('rename_file','move_file') then
 perform pg_advisory_xact_lock(hashtextextended(pid::text,0)); if f.metadata_version is distinct from (args->>'metadata_version')::bigint then raise exception 'METADATA_CONFLICT'; end if;
 if op='rename_file' then update public.files set name=public.valid_name(args->>'name'),language=coalesce(args->>'language',language),metadata_version=metadata_version+1 where id=fid;
 else par:=(args->>'parent_id')::uuid;
 if par=fid or(par is not null and not exists(select 1 from public.files where id=par and project_id=pid and kind='folder')) then raise exception 'INVALID_PARENT'; end if;
 if exists(with recursive d as(select id from public.files where parent_id=fid union all select x.id from public.files x join d on x.parent_id=d.id) select 1 from d where id=par) then raise exception 'FOLDER_CYCLE'; end if;
 update public.files set parent_id=par,metadata_version=metadata_version+1 where id=fid; end if;
 select to_jsonb(public.files.*) into result from public.files where id=fid; return result; end if;
 if op='delete_file' then delete from public.files where id=fid; return '{}'; end if;
 raise exception 'UNKNOWN_OPERATION';
end $$;
revoke all on function public.mutate(text,jsonb),public.project_role(uuid),public.workspace_role(uuid),public.valid_name(text) from public,anon;
grant execute on function public.mutate(text,jsonb),public.project_role(uuid),public.workspace_role(uuid) to authenticated;
commit;
