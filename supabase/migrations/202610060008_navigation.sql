begin;
create table public.file_preferences(user_id uuid not null references auth.users on delete cascade,file_id uuid not null references public.files on delete cascade,favorite boolean not null default false,opened_at timestamptz not null default now(),primary key(user_id,file_id));
alter table public.file_preferences enable row level security;
create policy preferences_owner on public.file_preferences for all to authenticated using(user_id=auth.uid() and exists(select 1 from public.files f where f.id=file_id and f.status='ready' and public.project_role(f.project_id) is not null)) with check(user_id=auth.uid() and exists(select 1 from public.files f where f.id=file_id and f.status='ready' and public.project_role(f.project_id) is not null));
grant select,insert,update,delete on public.file_preferences to authenticated;
create policy mentions_update on public.mentions for update to authenticated using(user_id=auth.uid() and exists(select 1 from public.comments c where c.id=comment_id)) with check(user_id=auth.uid());
grant update(read_at) on public.mentions to authenticated;
create function public.invitation_preview(hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare inv public.invitations;email text;result jsonb;begin
 select lower(u.email) into email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 select * into inv from public.invitations where token_hash=hash and email_key=email and used_at is null and expires_at>now();
 if inv.id is null then raise exception 'INVALID_INVITATION';end if;
 select jsonb_build_object('project',p.name,'workspace',w.name,'role',inv.role,'expires_at',inv.expires_at) into result from public.projects p join public.workspaces w on w.id=p.workspace_id where p.id=inv.project_id;return result;
end $$;
revoke all on function public.invitation_preview(text) from public,anon;grant execute on function public.invitation_preview(text) to authenticated;
commit;
