begin;
create table public.calderone(id uuid primary key,user_id uuid not null references auth.users on delete cascade,title text not null check(length(title) between 1 and 120),body text not null check(octet_length(body)<=600000),image text check(length(image)<=700000 and image ~ '^data:image/(png|jpeg|webp);base64,'),encrypted boolean not null default false,version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.calderone enable row level security;
create policy calderone_owner on public.calderone for select to authenticated using(user_id=auth.uid());
grant select on public.calderone to authenticated;
create function public.save_calderone(args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.calderone;result jsonb;begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,13));
 select * into item from public.calderone where id=(args->>'id')::uuid for update;
 if item.id is not null and (item.user_id<>auth.uid() or item.version is distinct from (args->>'version')::integer) then raise exception 'ENTRY_CONFLICT';end if;
 if args->>'delete'='true' then delete from public.calderone where id=item.id and user_id=auth.uid();return '{}';end if;
 if item.id is null and (select count(*) from public.calderone where user_id=auth.uid())>=500 then raise exception 'ENTRY_QUOTA';end if;
 insert into public.calderone(id,user_id,title,body,image,encrypted) values((args->>'id')::uuid,auth.uid(),public.valid_name(args->>'title'),args->>'body',nullif(args->>'image',''),coalesce((args->>'encrypted')::boolean,false))
 on conflict(id) do update set title=excluded.title,body=excluded.body,image=excluded.image,encrypted=excluded.encrypted,version=calderone.version+1,updated_at=now() returning to_jsonb(calderone.*) into result;return result;
end $$;
revoke all on function public.save_calderone(jsonb) from public,anon;grant execute on function public.save_calderone(jsonb) to authenticated;
commit;
