begin;
create table public.comment_threads(id uuid primary key default gen_random_uuid(),file_id uuid not null references public.files on delete cascade,generation integer not null,anchor jsonb not null default '{}',resolved boolean not null default false,created_by uuid not null references auth.users,created_at timestamptz not null default now());
create table public.comments(id uuid primary key default gen_random_uuid(),thread_id uuid not null references public.comment_threads on delete cascade,author_id uuid not null references auth.users,body text not null check(length(body) between 1 and 4000),created_at timestamptz not null default now());
create table public.mentions(comment_id uuid references public.comments on delete cascade,user_id uuid references auth.users on delete cascade,read_at timestamptz,primary key(comment_id,user_id));
create table public.file_links(id uuid primary key default gen_random_uuid(),source_id uuid not null references public.files on delete cascade,target_id uuid not null references public.files on delete cascade,label text not null check(length(label)<=120),anchor jsonb not null default '{}',target_anchor jsonb not null default '{}',created_by uuid not null references auth.users,unique(source_id,target_id,label));
create table public.board_items(id uuid primary key,project_id uuid not null references public.projects on delete cascade,kind text not null check(kind in ('note','file','group','edge')),body text not null default '' check(length(body)<=4000),file_id uuid references public.files on delete cascade,x integer not null default 0 check(abs(x)<=100000),y integer not null default 0 check(abs(y)<=100000),color text not null default '#fff2b3' check(color ~ '^#[0-9a-fA-F]{6}$'),source uuid,target uuid,group_id uuid,version integer not null default 1,updated_at timestamptz not null default now());
create table public.board_checkpoints(id uuid primary key default gen_random_uuid(),project_id uuid references public.projects on delete cascade,label text not null check(length(label) between 1 and 120),items jsonb not null,created_at timestamptz not null default now());
alter table public.board_checkpoints enable row level security;create policy read_board_checkpoints on public.board_checkpoints for select to authenticated using(public.project_role(project_id) is not null);grant select on public.board_checkpoints to authenticated;
alter table public.comment_threads enable row level security;alter table public.comments enable row level security;alter table public.mentions enable row level security;alter table public.file_links enable row level security;alter table public.board_items enable row level security;
create policy read_threads on public.comment_threads for select to authenticated using(exists(select 1 from public.files f where f.id=file_id and f.status='ready' and public.project_role(f.project_id) is not null));
create policy read_comments on public.comments for select to authenticated using(exists(select 1 from public.comment_threads t join public.files f on f.id=t.file_id where t.id=thread_id and f.status='ready' and public.project_role(f.project_id) is not null));
create policy read_mentions on public.mentions for select to authenticated using(user_id=auth.uid() and exists(select 1 from public.comments c where c.id=comment_id));
create policy read_links on public.file_links for select to authenticated using(exists(select 1 from public.files s join public.files t on t.id=target_id where s.id=source_id and s.status='ready' and t.status='ready' and public.project_role(s.project_id) is not null and public.project_role(t.project_id) is not null));
create policy read_board on public.board_items for select to authenticated using(public.project_role(project_id) is not null and (file_id is null or exists(select 1 from public.files f where f.id=file_id and f.status='ready' and public.project_role(f.project_id) is not null)));
grant select on public.comment_threads,public.comments,public.mentions,public.file_links,public.board_items to authenticated;
create function public.collaborate(op text,args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();fid uuid;tid uuid;pid uuid;bid uuid;cid uuid;f public.files;t public.comment_threads;r public.app_role;b public.board_items;result jsonb;mentioned uuid;dest public.files;
begin
 if uid is null then raise exception 'UNAUTHORIZED';end if;
 if op in ('thread','link') then
 fid:=(args->>'file_id')::uuid;select * into f from public.files where id=fid and status='ready';pid:=f.project_id;
 else if op in ('reply','resolve') then tid:=(args->>'thread_id')::uuid;select * into t from public.comment_threads where id=tid;select * into f from public.files where id=t.file_id and status='ready';pid:=f.project_id;
 else pid:=(args->>'project_id')::uuid;end if;end if;
 r:=public.project_role(pid);if r is null then raise exception 'FORBIDDEN';end if;
 if op in ('thread','reply','resolve') then
 if r<'commenter' then raise exception 'FORBIDDEN';end if;
 if op='thread' then
 if f.generation is distinct from (args->>'generation')::integer then raise exception 'GENERATION_CHANGED';end if;
 if octet_length(coalesce(args->'anchor','{}')::text)>4096 then raise exception 'ANCHOR_TOO_LARGE';end if;
 insert into public.comment_threads(file_id,generation,anchor,created_by) values(fid,f.generation,coalesce(args->'anchor','{}'),uid) returning id into tid;
 elsif op='resolve' then
 if r<'editor' and t.created_by<>uid then raise exception 'FORBIDDEN';end if;
 update public.comment_threads set resolved=(args->>'resolved')::boolean where id=tid;return '{}';
 end if;
 if t.id is not null and t.generation<>f.generation then raise exception 'GENERATION_CHANGED';end if;
 insert into public.comments(thread_id,author_id,body) values(tid,uid,trim(args->>'body')) returning id into cid;
 if jsonb_array_length(coalesce(args->'mentions','[]'))>10 then raise exception 'MENTION_LIMIT';end if;
 for mentioned in select value::uuid from jsonb_array_elements_text(coalesce(args->'mentions','[]')) loop
 if exists(select 1 from public.projects p join public.workspaces w on w.id=p.workspace_id join public.workspace_members wm on wm.workspace_id=w.id and wm.user_id=mentioned left join public.project_members pm on pm.project_id=p.id and pm.user_id=mentioned where p.id=pid and (w.owner_id=mentioned or wm.role>='admin' or pm.user_id is not null)) then insert into public.mentions values(cid,mentioned,null) on conflict do nothing;else raise exception 'MENTION_FORBIDDEN';end if;
 end loop;
 return jsonb_build_object('id',tid);
 end if;
 if r<'editor' then raise exception 'FORBIDDEN';end if;
 if op='link' then
 select * into dest from public.files where id=(args->>'target_id')::uuid and status='ready';
 if public.project_role(dest.project_id) is null then raise exception 'FORBIDDEN';end if;
 if octet_length(coalesce(args->'anchor','{}')::text)>4096 then raise exception 'ANCHOR_TOO_LARGE';end if;
 if octet_length(coalesce(args->'target_anchor','{}')::text)>4096 then raise exception 'ANCHOR_TOO_LARGE';end if;
 insert into public.file_links(source_id,target_id,label,anchor,target_anchor,created_by) values(fid,dest.id,left(coalesce(args->>'label',dest.name),120),coalesce(args->'anchor','{}'),coalesce(args->'target_anchor','{}'),uid) returning to_jsonb(file_links.*) into result;return result;
 end if;
 if op='board_checkpoint' then
 perform pg_advisory_xact_lock(hashtextextended(pid::text,12));
 insert into public.board_checkpoints(project_id,label,items) select pid,public.valid_name(args->>'label'),coalesce(jsonb_agg(to_jsonb(b)),'[]') from public.board_items b where project_id=pid returning to_jsonb(board_checkpoints.*) into result;
 delete from public.board_checkpoints where project_id=pid and id in(select id from public.board_checkpoints where project_id=pid order by created_at desc offset 20);return result;
 end if;
 if op in ('board_put','board_delete') then
 perform pg_advisory_xact_lock(hashtextextended(pid::text,12));bid:=(args->>'id')::uuid;
 select * into b from public.board_items where id=bid for update;
 if b.id is not null and (b.project_id<>pid or b.version is distinct from (args->>'version')::integer) then raise exception 'BOARD_CONFLICT';end if;
 if op='board_delete' then if exists(select 1 from public.board_items where project_id=pid and (source=bid or target=bid or group_id=bid)) then raise exception 'BOARD_REFERENCED';end if;delete from public.board_items where id=bid and project_id=pid;delete from public.board_items where project_id=pid and (source=bid or target=bid);update public.board_items set group_id=null,version=version+1 where project_id=pid and group_id=bid;return '{}';end if;
 if b.id is null and coalesce((args->>'version')::integer,0)<>0 then raise exception 'BOARD_CONFLICT';end if;
 if (select count(*) from public.board_items where project_id=pid)>=200 and b.id is null then raise exception 'BOARD_QUOTA';end if;
 if args->>'file_id' is not null and not exists(select 1 from public.files where id=(args->>'file_id')::uuid and project_id=pid and status='ready') then raise exception 'INVALID_TARGET';end if;
 if args->>'kind'='edge' and not exists(select 1 from public.board_items s join public.board_items d on d.id=(args->>'target')::uuid where s.id=(args->>'source')::uuid and s.project_id=pid and d.project_id=pid and s.kind<>'edge' and d.kind<>'edge') then raise exception 'INVALID_EDGE';end if;
 if args->>'group_id' is not null and not exists(select 1 from public.board_items where id=(args->>'group_id')::uuid and project_id=pid and kind='group' and id<>bid) then raise exception 'INVALID_GROUP';end if;
 insert into public.board_items(id,project_id,kind,body,file_id,x,y,color,source,target,group_id) values(bid,pid,args->>'kind',coalesce(args->>'body',''),(args->>'file_id')::uuid,coalesce((args->>'x')::integer,0),coalesce((args->>'y')::integer,0),coalesce(args->>'color','#fff2b3'),(args->>'source')::uuid,(args->>'target')::uuid,(args->>'group_id')::uuid)
 on conflict(id) do update set body=excluded.body,file_id=excluded.file_id,x=excluded.x,y=excluded.y,color=excluded.color,source=excluded.source,target=excluded.target,group_id=excluded.group_id,version=board_items.version+1,updated_at=now() returning to_jsonb(board_items.*) into result;return result;
 end if;
 raise exception 'UNKNOWN_OPERATION';
end $$;
revoke all on function public.collaborate(text,jsonb) from public,anon;
grant execute on function public.collaborate(text,jsonb) to authenticated;
commit;
