-- Endloop test board: image attachments on bugs and suggestions.
-- Run once in the Supabase SQL editor, after schema.sql. Safe to re-run.
--
-- Images are resized and compressed in the browser (about 100-400 KB each) and stored
-- as data URLs in their own table, behind the same passcode-checked functions as the
-- rest of the board. The board list only carries a count; the images themselves load
-- when someone opens the item.
--   * Tester or admin can add images to any bug or suggestion (up to 8 per item).
--   * Only admin can delete an image. Deleting a bug or suggestion deletes its images.

create table if not exists public.attachments (
  id          uuid primary key default gen_random_uuid(),
  item_kind   text not null check (item_kind in ('bug', 'suggestion')),
  item_id     uuid not null,
  name        text not null default '',
  data        text not null,
  bytes       integer not null,
  added_by    text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists attachments_item_idx on public.attachments (item_kind, item_id);

alter table public.attachments enable row level security;
revoke all on public.attachments from anon, authenticated;

-- Number of images on one item (used by board_read).
create or replace function public.board_file_count(p_kind text, p_item uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.attachments where item_kind = p_kind and item_id = p_item
$$;

revoke all on function public.board_file_count(text, uuid) from public, anon, authenticated;

-- Read: same as before, plus a 'files' count on each bug and suggestion.
create or replace function public.board_read(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r text := public.board_require(p_code, false);
begin
  return jsonb_build_object(
    'role', r,
    'bugs', coalesce((
      select jsonb_agg(public.board_item(b.id::text, b.num, b.data, b.created_at)
                       || jsonb_build_object('files', public.board_file_count('bug', b.id)) order by b.num)
      from public.bugs b), '[]'::jsonb),
    'suggestions', coalesce((
      select jsonb_agg(public.board_item(s.id::text, s.num, s.data, s.created_at)
                       || jsonb_build_object('files', public.board_file_count('suggestion', s.id)) order by s.num)
      from public.suggestions s), '[]'::jsonb),
    'roasts', coalesce((
      select jsonb_agg(r2.data || jsonb_build_object('id', r2.id) order by r2.id)
      from public.roasts r2), '[]'::jsonb)
  );
end
$$;

-- Add one image. p_data is a data URL: data:image/(webp|jpeg|png|gif);base64,...
create or replace function public.board_attach(p_code text, p_kind text, p_item uuid, p_name text, p_data text, p_by text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  row_id uuid; row_created timestamptz;
  size integer := octet_length(coalesce(p_data, ''));
begin
  perform public.board_require(p_code, false);
  if p_kind not in ('bug', 'suggestion') then
    raise exception 'bad_kind' using errcode = '22023';
  end if;
  if p_data is null or p_data !~ '^data:image/(webp|jpeg|png|gif);base64,[A-Za-z0-9+/=]+$' then
    raise exception 'bad_image' using errcode = '22023';
  end if;
  if size > 2000000 then
    raise exception 'too_big' using errcode = '22023';
  end if;
  if (p_kind = 'bug' and not exists (select 1 from public.bugs where id = p_item))
     or (p_kind = 'suggestion' and not exists (select 1 from public.suggestions where id = p_item)) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if public.board_file_count(p_kind, p_item) >= 8 then
    raise exception 'too_many' using errcode = '22023';
  end if;

  insert into public.attachments (item_kind, item_id, name, data, bytes, added_by)
  values (p_kind, p_item, left(coalesce(p_name, ''), 120), p_data, size, left(coalesce(p_by, ''), 60))
  returning id, created_at into row_id, row_created;
  return jsonb_build_object('id', row_id, 'name', left(coalesce(p_name, ''), 120), 'bytes', size,
                            'addedBy', left(coalesce(p_by, ''), 60), 'createdAt', row_created);
end
$$;

-- All images on one item, oldest first.
create or replace function public.board_attachments(p_code text, p_kind text, p_item uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.board_require(p_code, false);
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'data', a.data, 'bytes', a.bytes,
                                        'addedBy', a.added_by, 'createdAt', a.created_at) order by a.created_at)
    from public.attachments a where a.item_kind = p_kind and a.item_id = p_item), '[]'::jsonb);
end
$$;

create or replace function public.board_delete_attachment(p_code text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.board_require(p_code, true);
  delete from public.attachments where id = p_id;
end
$$;

-- Delete: same as before, plus the item's images.
create or replace function public.board_delete(p_code text, p_kind text, p_id text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.board_require(p_code, true);
  if p_kind = 'bug' then
    delete from public.bugs where id = p_id::uuid;
    delete from public.attachments where item_kind = 'bug' and item_id = p_id::uuid;
  elsif p_kind = 'suggestion' then
    delete from public.suggestions where id = p_id::uuid;
    delete from public.attachments where item_kind = 'suggestion' and item_id = p_id::uuid;
  elsif p_kind = 'roast' then
    delete from public.roasts where id = p_id;
  else
    raise exception 'bad_kind' using errcode = '22023';
  end if;
end
$$;

revoke all on function public.board_attach(text, text, uuid, text, text, text) from public;
revoke all on function public.board_attachments(text, text, uuid)            from public;
revoke all on function public.board_delete_attachment(text, uuid)            from public;
grant execute on function public.board_attach(text, text, uuid, text, text, text) to anon, authenticated;
grant execute on function public.board_attachments(text, text, uuid)            to anon, authenticated;
grant execute on function public.board_delete_attachment(text, uuid)            to anon, authenticated;
