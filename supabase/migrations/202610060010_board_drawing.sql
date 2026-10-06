begin;
-- Reuse board_put's editor ACL, per-item CAS, quotas and checkpoint history.
alter table public.board_items drop constraint board_items_kind_check;
alter table public.board_items add constraint board_items_kind_check
  check(kind in ('note','file','group','edge','stroke'));
create function public.validate_board_drawing() returns trigger
language plpgsql set search_path='' as $$
declare drawing jsonb; point jsonb; component jsonb;
begin
 if new.kind <> 'stroke' then return new; end if;
 begin
  drawing := new.body::jsonb;
  if jsonb_typeof(drawing) <> 'object'
    or drawing->'version' is distinct from '1'::jsonb
    or jsonb_typeof(drawing->'width') is distinct from 'number'
    or (drawing->>'width')::numeric <> trunc((drawing->>'width')::numeric)
    or (drawing->>'width')::numeric not between 1 and 32
    or jsonb_typeof(drawing->'points') is distinct from 'array' then
   raise exception 'INVALID_DRAWING';
  end if;
  if jsonb_array_length(drawing->'points') not between 1 and 128 then raise exception 'INVALID_DRAWING'; end if;
  for point in select value from jsonb_array_elements(drawing->'points') loop
   if jsonb_typeof(point) <> 'array' then raise exception 'INVALID_DRAWING'; end if;
   if jsonb_array_length(point) <> 2 then raise exception 'INVALID_DRAWING'; end if;
   for component in select value from jsonb_array_elements(point) loop
    if jsonb_typeof(component) <> 'number' then raise exception 'INVALID_DRAWING'; end if;
    if component::text::numeric not between 0 and 100000
      or component::text::numeric <> trunc(component::text::numeric) then raise exception 'INVALID_DRAWING'; end if;
   end loop;
  end loop;
 exception when others then raise exception 'INVALID_DRAWING';
 end;
 return new;
end $$;
revoke all on function public.validate_board_drawing() from public,anon,authenticated;
create trigger validate_board_drawing before insert or update on public.board_items
 for each row execute function public.validate_board_drawing();
-- Fix the preexisting PL/pgSQL variable/table-alias collision in board_checkpoint.
create or replace function public.collaborate(op text,args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
 insert into public.board_checkpoints(project_id,label,items) select pid,public.valid_name(args->>'label'),coalesce(jsonb_agg(to_jsonb(board_row)),'[]') from public.board_items board_row where project_id=pid returning to_jsonb(board_checkpoints.*) into result;
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
commit;
