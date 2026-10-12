-- Set or change the two board passcodes.
-- 1. Replace the two example codes below with your own (long and hard to guess).
-- 2. Run this in the Supabase SQL editor. Run it again any time you want to change a code.
-- 3. Don't commit your real codes to GitHub; edit them here in the SQL editor only.

insert into public.board_codes (role, code_hash) values
  ('admin',  extensions.crypt('replace-with-your-admin-code',  extensions.gen_salt('bf'))),
  ('tester', extensions.crypt('replace-with-the-tester-code', extensions.gen_salt('bf')))
on conflict (role) do update set code_hash = excluded.code_hash;
