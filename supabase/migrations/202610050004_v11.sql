begin;
alter table public.workspaces add column is_personal boolean not null default false;
create unique index personal_workspace_owner on public.workspaces(owner_id) where is_personal;
alter table public.projects add column is_personal boolean not null default false;
create unique index personal_project_workspace on public.projects(workspace_id) where is_personal;
alter table public.projects add column theme text not null default '' check(length(theme)<=60);
alter table public.files add column theme text not null default '' check(length(theme)<=60);
alter table public.files add column updated_at timestamptz not null default now();
alter table public.files add column last_modified_by uuid references auth.users on delete set null;
alter table public.files add column activity_seq bigint not null default 0;
create index files_activity on public.files(updated_at desc) where kind='text';
create function public.file_metadata_activity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' or NEW.name is distinct from OLD.name or NEW.parent_id is distinct from OLD.parent_id or NEW.theme is distinct from OLD.theme or NEW.generation is distinct from OLD.generation then
 NEW.updated_at:=now(); NEW.last_modified_by:=auth.uid();
 if TG_OP='UPDATE' and NEW.generation is distinct from OLD.generation then NEW.activity_seq:=0; end if;
 end if; return NEW;
end $$;
create trigger file_metadata_activity before insert or update on public.files for each row execute function public.file_metadata_activity();
-- Called only after the authoritative Durable Object commit. Activity is an index, never content authority.
create function public.record_file_activity(fid uuid,gen integer,seq bigint) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.project_role((select project_id from public.files where id=fid))>='editor',false) then raise exception 'FORBIDDEN'; end if;
 update public.files set updated_at=now(),last_modified_by=auth.uid(),activity_seq=seq where id=fid and generation=gen and activity_seq<seq and status='ready';
end $$;
alter function public.mutate(text,jsonb) rename to mutate_v1;
revoke all on function public.mutate_v1(text,jsonb) from authenticated;
create function public.mutate(op text,args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); wid uuid; pid uuid; fid uuid; result jsonb; topic text;
begin
 if uid is null then raise exception 'UNAUTHORIZED'; end if;
 if op='create_standalone' then
 perform pg_advisory_xact_lock(hashtextextended(uid::text,1));
 select id into wid from public.workspaces where owner_id=uid and is_personal;
 if wid is null then
 insert into public.workspaces(name,owner_id,is_personal) values('File personali',uid,true) returning id into wid;
 insert into public.workspace_members values(wid,uid,'owner'); end if;
 select id into pid from public.projects where workspace_id=wid and is_personal;
 if pid is null then insert into public.projects(workspace_id,name,created_by,is_personal) values(wid,'File personali',uid,true) returning id into pid; end if;
 return public.mutate_v1('create_file',jsonb_build_object('name',args->>'name','kind','text','language',coalesce(args->>'language','plaintext'),'project_id',pid));
 end if;
 if op='create_project' and exists(select 1 from public.workspaces where id=(args->>'workspace_id')::uuid and is_personal) then raise exception 'PERSONAL_SPACE_PRIVATE'; end if;
 if op='set_theme' then
 topic:=trim(coalesce(args->>'theme','')); if length(topic)>60 then raise exception 'INVALID_THEME'; end if;
 if args->>'kind'='project' then
 pid:=(args->>'id')::uuid; if not coalesce(public.project_role(pid)>='editor',false) then raise exception 'FORBIDDEN'; end if;
 update public.projects set theme=topic where id=pid returning to_jsonb(public.projects.*) into result;
 else
 fid:=(args->>'id')::uuid; select project_id into pid from public.files where id=fid;
 if not coalesce(public.project_role(pid)>='editor',false) then raise exception 'FORBIDDEN'; end if;
 update public.files set theme=topic where id=fid returning to_jsonb(public.files.*) into result;
 end if; return result;
 end if;
 -- Personal containers cannot acquire members or invitations through the existing APIs.
 if op in ('create_invite','set_member','accept_invite') then
 if op='accept_invite' then select project_id into pid from public.invitations where token_hash=args->>'token_hash'; else pid:=(args->>'project_id')::uuid; end if;
 if exists(select 1 from public.projects where id=pid and is_personal) then raise exception 'PERSONAL_SPACE_PRIVATE'; end if;
 end if;
 return public.mutate_v1(op,args);
end $$;
revoke all on function public.mutate(text,jsonb),public.record_file_activity(uuid,integer,bigint),public.file_metadata_activity() from public,anon;
grant execute on function public.mutate(text,jsonb),public.record_file_activity(uuid,integer,bigint) to authenticated;
commit;
