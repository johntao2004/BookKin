\set ON_ERROR_STOP on

begin;

insert into app_users(id, username, display_name, password_hash, role, status, must_change_password,
                      created_at, updated_at, last_login_at, password_changed_at)
select '10000000-0000-4000-8000-000000000002', 'curator', '书库管理员', password_hash,
       'ADMIN', 'ACTIVE', false, now() - interval '2 days', now(), now() - interval '3 hours', now() - interval '2 days'
  from app_users where lower(username) = 'owner'
on conflict (id) do update set display_name = excluded.display_name, role = excluded.role,
  status = excluded.status, must_change_password = excluded.must_change_password, updated_at = now();

insert into app_users(id, username, display_name, password_hash, role, status, must_change_password,
                      created_at, updated_at, last_login_at, password_changed_at)
select '10000000-0000-4000-8000-000000000003', 'reader', '家庭成员', password_hash,
       'MEMBER', 'ACTIVE', false, now() - interval '1 day', now(), now() - interval '8 hours', now() - interval '1 day'
  from app_users where lower(username) = 'owner'
on conflict (id) do update set display_name = excluded.display_name, role = excluded.role,
  status = excluded.status, must_change_password = excluded.must_change_password, updated_at = now();

insert into series(id, name, sort_name)
values ('20000000-0000-4000-8000-000000000001', '灯火集', '灯火集')
on conflict do nothing;

update books
   set series_id = (select id from series where lower(name) = lower('灯火集') limit 1),
       series_index = case title
         when '山川与灯火' then 1 when '城与钟声' then 2 end,
       updated_at = now()
 where title in ('山川与灯火', '城与钟声');

update books set created_at = now() - case title
  when '山川与灯火' then interval '1 hour'
  when '城与钟声' then interval '3 hours'
  when '雾港信使' then interval '8 hours'
  when '灯塔以南' then interval '1 day'
  end
 where title in ('山川与灯火', '城与钟声', '雾港信使', '灯塔以南');

delete from annotations a
 using app_users u, books b
 where a.user_id = u.id and a.book_id = b.id
   and lower(u.username) in ('owner', 'curator', 'reader')
   and b.title in ('山川与灯火', '城与钟声', '雾港信使', '灯塔以南');

delete from reading_positions rp
 using app_users u, books b
 where rp.user_id = u.id and rp.book_id = b.id
   and lower(u.username) in ('owner', 'curator', 'reader')
   and b.title in ('山川与灯火', '城与钟声', '雾港信使', '灯塔以南');

delete from reading_time_daily rtd
 using app_users u, books b
 where rtd.user_id = u.id and rtd.book_id = b.id
   and lower(u.username) in ('owner', 'curator', 'reader')
   and b.title in ('山川与灯火', '城与钟声', '雾港信使', '灯塔以南');

delete from file_operations
 where id in (
   '60000000-0000-4000-8000-000000000001',
   '60000000-0000-4000-8000-000000000002'
 );

delete from recycle_bin_entries
 where id = '50000000-0000-4000-8000-000000000001';

delete from audit_events
 where id in (
   '70000000-0000-4000-8000-000000000001',
   '70000000-0000-4000-8000-000000000002'
 );

commit;

select
  (select count(*) from app_users) as users,
  (select count(*) from books) as books,
  (select count(*) from book_files where status = 'AVAILABLE') as available_files,
  (select count(*) from reading_positions) as reading_positions,
  (select count(*) from reading_time_daily) as reading_time_daily,
  (select count(*) from annotations) as annotations,
  (select count(*) from recycle_bin_entries where restored_at is null and purged_at is null) as recycle_entries,
  (select count(*) from file_operations) as file_operations;
