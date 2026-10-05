begin;
create table public.resource_reservations(file_id uuid not null references public.files on delete cascade,kind text not null check(kind in ('generation','checkpoint')),resource_id text not null,size_bytes bigint not null check(size_bytes between 0 and 8388608),primary key(file_id,kind,resource_id));
alter table public.resource_reservations enable row level security;
revoke all on public.resource_reservations from anon,authenticated;
grant all on public.resource_reservations to service_role;
create function public.reserve_document_bytes(fid uuid,gen integer,n bigint) returns void language plpgsql security definer set search_path='' as $$
declare wid uuid; pid uuid; previous bigint; total bigint;
begin
 select workspace_id,project_id into wid,pid from public.files where id=fid and generation=gen and status='ready';
 if wid is null or not coalesce(public.project_role(pid)>='editor',false) then raise exception 'ACCESS_CHANGED'; end if;
 if n not between 0 and 8388608 then raise exception 'QUOTA'; end if;
 perform pg_advisory_xact_lock(hashtextextended(wid::text,1));
 select coalesce(size_bytes,0) into previous from public.resource_reservations where file_id=fid and kind='generation' and resource_id=gen::text;
 select coalesce(sum(r.size_bytes),0) into total from public.resource_reservations r join public.files f on f.id=r.file_id where f.workspace_id=wid;
 if total+greatest(0,n-coalesce(previous,0))>104857600 then raise exception 'WORKSPACE_QUOTA'; end if;
 insert into public.resource_reservations values(fid,'generation',gen::text,n) on conflict(file_id,kind,resource_id) do update set size_bytes=greatest(public.resource_reservations.size_bytes,excluded.size_bytes);
end $$;
create function public.reserve_checkpoint_bytes(fid uuid,cid uuid,n bigint) returns void language plpgsql security definer set search_path='' as $$
declare wid uuid; total bigint; old_size bigint;
begin
 select workspace_id into wid from public.files where id=fid;
 if wid is null or n not between 1 and 8388608 then raise exception 'QUOTA'; end if;
 -- Only the trusted checkpoint publisher can call this RPC; it has no authenticated/anon grant.
 perform pg_advisory_xact_lock(hashtextextended(wid::text,1));
 select coalesce(size_bytes,0) into old_size from public.resource_reservations where file_id=fid and kind='checkpoint' and resource_id=cid::text;
 select coalesce(sum(r.size_bytes),0) into total from public.resource_reservations r join public.files f on f.id=r.file_id where f.workspace_id=wid;
 if total+greatest(0,n-coalesce(old_size,0))>104857600 then raise exception 'WORKSPACE_QUOTA'; end if;
 insert into public.resource_reservations values(fid,'checkpoint',cid::text,n) on conflict(file_id,kind,resource_id) do nothing;
end $$;
revoke all on function public.reserve_document_bytes(uuid,integer,bigint),public.reserve_checkpoint_bytes(uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.reserve_document_bytes(uuid,integer,bigint) to authenticated;
grant execute on function public.reserve_checkpoint_bytes(uuid,uuid,bigint) to service_role;
commit;
