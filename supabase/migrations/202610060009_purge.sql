begin;
create table public.trash_purge_jobs(root_id uuid primary key,project_id uuid not null references public.projects on delete cascade,manifest jsonb not null,completed_at timestamptz,created_at timestamptz not null default now());
alter table public.trash_purge_jobs enable row level security;
create policy purge_admin on public.trash_purge_jobs for select to authenticated using(public.project_role(project_id)>='admin');grant select on public.trash_purge_jobs to authenticated;
create function public.begin_purge(root uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.files;j public.trash_purge_jobs;manifest jsonb;begin
 select * into j from public.trash_purge_jobs where root_id=root;
 if j.root_id is not null then if not coalesce(public.project_role(j.project_id)>='admin',false) then raise exception 'FORBIDDEN';end if;return to_jsonb(j);end if;
 select * into f from public.files where id=root for update;if not coalesce(public.project_role(f.project_id)>='admin',false) then raise exception 'FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended(f.project_id::text,0));
 if f.status<>'deleted' or f.deleted_root<>root then raise exception 'NOT_TRASHED';end if;
 with recursive descendants as(select id,generation,status from public.files where id=root union all select x.id,x.generation,x.status from public.files x join descendants d on x.parent_id=d.id)
 select jsonb_agg(jsonb_build_object('id',id,'generation',generation,'status',status)) into manifest from descendants;
 if exists(select 1 from jsonb_array_elements(manifest) e where e->>'status'<>'deleted' or (e->>'generation')::integer>1000) then raise exception 'ACTIVE_DESCENDANT';end if;
 insert into public.trash_purge_jobs values(root,f.project_id,manifest,null,now()) returning * into j;return to_jsonb(j);
end $$;
create function public.finish_purge(root uuid) returns void language plpgsql security definer set search_path='' as $$
declare j public.trash_purge_jobs;begin
 if auth.role()<>'service_role' then raise exception 'FORBIDDEN';end if;
 select * into j from public.trash_purge_jobs where root_id=root for update;if j.root_id is null then raise exception 'PURGE_NOT_FOUND';end if;if j.completed_at is not null then return;end if;
 if exists(select 1 from public.files f join jsonb_array_elements(j.manifest) e on f.id=(e->>'id')::uuid where f.status<>'deleted' or f.generation<>(e->>'generation')::integer) then raise exception 'PURGE_CONFLICT';end if;
 delete from public.files where id=root and status='deleted';update public.trash_purge_jobs set completed_at=now() where root_id=root;
end $$;
alter function public.mutate(text,jsonb) rename to mutate_v16;revoke all on function public.mutate_v16(text,jsonb) from authenticated;
create function public.mutate(op text,args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if op in ('restore_deleted','move_file','rename_file','begin_restore','finish_restore','delete_file') and exists(select 1 from public.trash_purge_jobs j cross join jsonb_array_elements(j.manifest) e where e->>'id'=args->>'id') then raise exception 'PURGE_IN_PROGRESS';end if;
 if op in ('move_file','begin_restore','finish_restore') and exists(select 1 from public.files where id=(args->>'id')::uuid and status='deleted') then raise exception 'FILE_DELETED';end if;
 return public.mutate_v16(op,args);
end $$;
revoke all on function public.begin_purge(uuid),public.finish_purge(uuid),public.mutate(text,jsonb) from public,anon,authenticated;
grant execute on function public.begin_purge(uuid),public.mutate(text,jsonb) to authenticated;grant execute on function public.finish_purge(uuid) to service_role;
commit;
