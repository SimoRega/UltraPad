begin;
alter table public.workspaces add column emoji text not null default '' check(length(emoji)<=16);
alter table public.files add column deleted_at timestamptz;
alter table public.files add column deleted_root uuid;
alter table public.files drop constraint files_status_check;
alter table public.files add constraint files_status_check check(status in ('ready','restoring','deleted'));
drop index public.files_names;
create unique index files_names on public.files(project_id,coalesce(parent_id,'00000000-0000-0000-0000-000000000000'::uuid),name_key) where deleted_at is null;
create table public.file_search(file_id uuid primary key references public.files on delete cascade,generation integer not null,seq bigint not null,body text not null check(octet_length(body)<=1048576),indexed_at timestamptz not null default now(),words tsvector generated always as(to_tsvector('simple',body)) stored);
create index file_search_words on public.file_search using gin(words);
alter table public.file_search enable row level security;
create policy read_search on public.file_search for select to authenticated using(exists(select 1 from public.files f where f.id=file_id and f.status='ready' and f.generation=file_search.generation and public.project_role(f.project_id) is not null));
grant select on public.file_search to authenticated;
create function public.index_file(fid uuid,gen integer,seq bigint,body text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.files f where f.id=fid and f.generation=gen and f.status='ready' and public.project_role(f.project_id)>='editor') then raise exception 'FORBIDDEN'; end if;
 insert into public.file_search values(fid,gen,seq,body,now()) on conflict(file_id) do update set generation=excluded.generation,seq=excluded.seq,body=excluded.body,indexed_at=now() where (file_search.generation,file_search.seq)<(excluded.generation,excluded.seq);
end $$;
create function public.search_files(q text,offset_rows integer default 0,workspace uuid default null,format text default '',topic text default '',author uuid default null,since timestamptz default null) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from (
 select f.*,substring(s.body from greatest(1,position(lower(q) in lower(s.body))-80) for 300) excerpt,s.indexed_at from public.files f left join public.file_search s on s.file_id=f.id and s.generation=f.generation
 where f.status='ready' and f.kind='text' and (workspace is null or f.workspace_id=workspace) and (format='' or lower(f.name) like '%.'||lower(format)) and (topic='' or f.theme=topic) and (author is null or f.last_modified_by=author) and (since is null or f.updated_at>=since)
 and (q='' or f.name ilike '%'||q||'%' or f.theme ilike '%'||q||'%' or s.words @@ websearch_to_tsquery('simple',left(q,200)))
 order by f.updated_at desc,f.id limit 50 offset greatest(0,least(offset_rows,100000))
 ) r
$$;
alter function public.mutate(text,jsonb) rename to mutate_v15;
revoke all on function public.mutate_v15(text,jsonb) from authenticated;
create function public.mutate(op text,args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();fid uuid;pid uuid;wid uuid;f public.files;result jsonb;inv public.invitations;
begin
 if uid is null then raise exception 'UNAUTHORIZED'; end if;
 if op='rename_workspace' then
 wid:=(args->>'id')::uuid;if not coalesce(public.workspace_role(wid)>='admin',false) then raise exception 'FORBIDDEN';end if;
 update public.workspaces set name=public.valid_name(args->>'name'),emoji=left(coalesce(args->>'emoji',''),16) where id=wid returning to_jsonb(workspaces.*) into result;return result;
 end if;
 if op='rename_project' then
 pid:=(args->>'id')::uuid;if not coalesce(public.project_role(pid)>='editor',false) then raise exception 'FORBIDDEN';end if;
 update public.projects set name=public.valid_name(args->>'name') where id=pid returning to_jsonb(projects.*) into result;return result;
 end if;
 if op='revoke_invite' then
 select * into inv from public.invitations where id=(args->>'id')::uuid for update;
 if not coalesce(public.project_role(inv.project_id)>='admin',false) then raise exception 'FORBIDDEN';end if;
 update public.invitations set expires_at=least(expires_at,now()) where id=inv.id;return '{}';
 end if;
 if op in ('delete_file','restore_deleted') then
 fid:=(args->>'id')::uuid;select * into f from public.files where id=fid for update;
 if not coalesce(public.project_role(f.project_id)>='editor',false) then raise exception 'FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended(f.project_id::text,0));
 if op='delete_file' then
 if f.status='restoring' then raise exception 'RESTORE_IN_PROGRESS';end if;
 with recursive d as(select id from public.files where id=fid union all select x.id from public.files x join d on x.parent_id=d.id where x.deleted_at is null)
 update public.files set deleted_at=now(),deleted_root=fid,status='deleted' where id in(select id from d) and deleted_at is null;
 else
 if f.deleted_root is distinct from fid then raise exception 'RESTORE_PARENT_FIRST';end if;
 if f.parent_id is not null and not exists(select 1 from public.files where id=f.parent_id and deleted_at is null) then update public.files set parent_id=null where id=fid;end if;
 update public.files set deleted_at=null,deleted_root=null,status='ready',metadata_version=metadata_version+1 where deleted_root=fid;
 end if;
 return '{}';
 end if;
 if op in ('create_file','move_file') and exists(select 1 from public.files where id=(args->>'parent_id')::uuid and deleted_at is not null) then raise exception 'INVALID_PARENT';end if;
 if op='rename_file' and exists(select 1 from public.files where id=(args->>'id')::uuid and deleted_at is not null) then raise exception 'FILE_DELETED';end if;
 return public.mutate_v15(op,args);
end $$;
create function public.project_invitations(pid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 if not coalesce(public.project_role(pid)>='admin',false) then raise exception 'FORBIDDEN';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'email',email_key,'role',role,'expires_at',expires_at,'used_at',used_at)),'[]') into result from public.invitations where project_id=pid;return result;
end $$;
revoke all on function public.index_file(uuid,integer,bigint,text),public.search_files(text,integer,uuid,text,text,uuid,timestamptz),public.mutate(text,jsonb),public.project_invitations(uuid) from public,anon;
grant execute on function public.index_file(uuid,integer,bigint,text),public.search_files(text,integer,uuid,text,text,uuid,timestamptz),public.mutate(text,jsonb),public.project_invitations(uuid) to authenticated;

create table public.guest_transfers(user_id uuid not null references auth.users on delete cascade,source_id uuid not null,file_id uuid not null references public.files on delete cascade,primary key(user_id,source_id));
alter table public.guest_transfers enable row level security;
create policy guest_transfer_owner on public.guest_transfers for select to authenticated using(user_id=auth.uid());
grant select on public.guest_transfers to authenticated;
create function public.transfer_guest(source uuid,n text,lang text default 'plaintext') returns jsonb language plpgsql security definer set search_path='' as $$
declare f jsonb;fid uuid;begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,7));
 select file_id into fid from public.guest_transfers where user_id=auth.uid() and source_id=source;
 if fid is not null then select to_jsonb(files.*) into f from public.files where id=fid;return f;end if;
 f:=public.mutate('create_standalone',jsonb_build_object('name',public.valid_name(n),'language',lang));
 insert into public.guest_transfers values(auth.uid(),source,(f->>'id')::uuid);return f;
end $$;
revoke all on function public.transfer_guest(uuid,text,text) from public,anon;
grant execute on function public.transfer_guest(uuid,text,text) to authenticated;
commit;
