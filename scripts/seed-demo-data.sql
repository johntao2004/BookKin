\set ON_ERROR_STOP on

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
         when '山川与灯火' then 1 when '夜航记' then 2 when '夏日植物学' then 3 when '城与钟声' then 4 end,
       updated_at = now()
 where title in ('山川与灯火', '夜航记', '夏日植物学', '城与钟声');

update books set created_at = now() - case title
  when '山川与灯火' then interval '1 hour'
  when '夜航记' then interval '3 hours'
  when '夏日植物学' then interval '8 hours'
  when '城与钟声' then interval '1 day'
  when '雾港信使' then interval '2 days'
  when '鲸落之时' then interval '3 days'
  when '灯塔以南' then interval '4 days'
  when '微光标本' then interval '5 days'
  when '纸上群山' then interval '6 days'
  when '慢读手册' then interval '7 days'
  when '风从书页来' then interval '8 days'
  when '海岸线之外' then interval '9 days'
  else interval '10 days' end;

insert into reading_positions(user_id, book_id, locator, progress, device_id, updated_at)
select u.id, b.id, 'epubcfi(/6/4!/4/10)', 0.68000, 'macbook-air-web', now() - interval '12 minutes'
  from app_users u cross join books b where lower(u.username) = 'owner' and b.title = '山川与灯火'
on conflict (user_id, book_id) do update set locator = excluded.locator, progress = excluded.progress,
  device_id = excluded.device_id, updated_at = excluded.updated_at;

insert into reading_positions(user_id, book_id, locator, progress, device_id, updated_at)
select u.id, b.id, 'page:1', 0.42000, 'ipad-web', now() - interval '3 hours'
  from app_users u cross join books b where lower(u.username) = 'owner' and b.title = '夜航记'
on conflict (user_id, book_id) do update set locator = excluded.locator, progress = excluded.progress,
  device_id = excluded.device_id, updated_at = excluded.updated_at;

insert into annotations(id, user_id, book_id, annotation_type, locator, quote, note, annotation_style, color, created_at, updated_at)
select '30000000-0000-4000-8000-000000000001', u.id, b.id, 'HIGHLIGHT', 'epubcfi(/6/4!/4/6)',
       '把一天的光慢慢折进书页', null, 'HIGHLIGHT', 'CORAL', now() - interval '7 hours', now() - interval '7 hours'
  from app_users u cross join books b where lower(u.username) = 'owner' and b.title = '山川与灯火'
on conflict (id) do update set quote = excluded.quote, note = excluded.note, annotation_style = excluded.annotation_style, updated_at = excluded.updated_at;

insert into annotations(id, user_id, book_id, annotation_type, locator, quote, note, annotation_style, color, created_at, updated_at)
select '30000000-0000-4000-8000-000000000002', u.id, b.id, 'NOTE', 'epubcfi(/6/4!/4/10)',
       '这里有人生活过，今晚也仍会有人守着火', '喜欢这句话里安静而坚定的陪伴感。', 'HIGHLIGHT', 'CORAL', now() - interval '5 hours', now() - interval '5 hours'
  from app_users u cross join books b where lower(u.username) = 'owner' and b.title = '山川与灯火'
on conflict (id) do update set quote = excluded.quote, note = excluded.note, annotation_style = excluded.annotation_style, updated_at = excluded.updated_at;

insert into annotations(id, user_id, book_id, annotation_type, locator, quote, note, annotation_style, color, created_at, updated_at)
select '30000000-0000-4000-8000-000000000003', u.id, b.id, 'HIGHLIGHT', 'epubcfi(/6/4!/4/12)',
       '有些路不是为了抵达', null, 'UNDERLINE', 'CORAL', now() - interval '2 hours', now() - interval '2 hours'
  from app_users u cross join books b where lower(u.username) = 'owner' and b.title = '山川与灯火'
on conflict (id) do update set quote = excluded.quote, note = excluded.note, annotation_style = excluded.annotation_style, updated_at = excluded.updated_at;

insert into annotations(id, user_id, book_id, annotation_type, locator, quote, note, annotation_style, color, created_at, updated_at)
select '30000000-0000-4000-8000-000000000004', u.id, b.id, 'HIGHLIGHT', 'epubcfi(/6/4!/4/8)',
       '像已经等了许多年', null, 'BOLD', 'CORAL', now() - interval '1 hour', now() - interval '1 hour'
  from app_users u cross join books b where lower(u.username) = 'owner' and b.title = '山川与灯火'
on conflict (id) do update set quote = excluded.quote, note = excluded.note, annotation_style = excluded.annotation_style, updated_at = excluded.updated_at;

insert into annotations(id, user_id, book_id, annotation_type, locator, quote, note, annotation_style, color, created_at, updated_at)
select '30000000-0000-4000-8000-000000000005', u.id, b.id, 'BOOKMARK', 'epubcfi(/6/4!/4/10)',
       null, null, 'HIGHLIGHT', 'GOLD', now() - interval '30 minutes', now() - interval '30 minutes'
  from app_users u cross join books b where lower(u.username) = 'owner' and b.title = '山川与灯火'
on conflict (id) do update set locator = excluded.locator, updated_at = excluded.updated_at;

update book_files set status = 'TRASHED', updated_at = now()
 where book_id = (select id from books where title = '声之来信' limit 1);

insert into recycle_bin_entries(id, book_file_id, library_root_id, original_path, trash_path, fingerprint,
                                size_bytes, deleted_by, deleted_at, expires_at)
select '50000000-0000-4000-8000-000000000001', bf.id, bf.library_root_id, bf.relative_path, :'trash_path',
       bf.fingerprint, bf.size_bytes, u.id, now() - interval '6 hours', now() + interval '29 days 18 hours'
  from book_files bf join books b on b.id = bf.book_id cross join app_users u
 where b.title = '声之来信' and lower(u.username) = 'curator'
on conflict (id) do update set trash_path = excluded.trash_path, fingerprint = excluded.fingerprint,
  size_bytes = excluded.size_bytes, deleted_by = excluded.deleted_by, expires_at = excluded.expires_at,
  restored_at = null, purged_at = null;

insert into file_operations(id, idempotency_key, requested_by, operation_type, status, stage, book_file_id,
                            source_root_id, target_root_id, source_path, target_path, expected_fingerprint,
                            resulting_fingerprint, request_payload, started_at, completed_at, created_at, updated_at)
select '60000000-0000-4000-8000-000000000001', 'demo-write-metadata-v1', u.id, 'WRITE_METADATA',
       'SUCCEEDED', 'COMPLETED', bf.id, bf.library_root_id, bf.library_root_id, bf.relative_path, bf.relative_path,
       bf.fingerprint, bf.fingerprint, '{"fields":["title","author","cover"]}'::jsonb,
       now() - interval '1 day 1 minute', now() - interval '1 day', now() - interval '1 day 1 minute', now() - interval '1 day'
  from book_files bf join books b on b.id = bf.book_id cross join app_users u
 where b.title = '山川与灯火' and lower(u.username) = 'owner'
on conflict (id) do update set status = excluded.status, stage = excluded.stage, updated_at = excluded.updated_at;

insert into file_operations(id, idempotency_key, requested_by, operation_type, status, stage, book_file_id,
                            recycle_bin_entry_id, source_root_id, source_path, target_path, expected_fingerprint,
                            resulting_fingerprint, request_payload, started_at, completed_at, created_at, updated_at)
select '60000000-0000-4000-8000-000000000002', 'demo-trash-letter-v1', u.id, 'TRASH',
       'SUCCEEDED', 'COMPLETED', bf.id, '50000000-0000-4000-8000-000000000001', bf.library_root_id,
       bf.relative_path, :'trash_path', bf.fingerprint, bf.fingerprint, '{}'::jsonb,
       now() - interval '6 hours 1 minute', now() - interval '6 hours', now() - interval '6 hours 1 minute', now() - interval '6 hours'
  from book_files bf join books b on b.id = bf.book_id cross join app_users u
 where b.title = '声之来信' and lower(u.username) = 'curator'
on conflict (id) do update set status = excluded.status, stage = excluded.stage, target_path = excluded.target_path, updated_at = excluded.updated_at;

insert into audit_events(id, actor_id, event_type, subject_type, subject_id, source_path, target_path,
                         before_fingerprint, after_fingerprint, outcome, detail, occurred_at)
select '70000000-0000-4000-8000-000000000001', u.id, 'FILE_TRASHED', 'BOOK_FILE', bf.id::text,
       bf.relative_path, :'trash_path', bf.fingerprint, bf.fingerprint, 'SUCCEEDED',
       '{"source":"demo-seed","retentionDays":30}'::jsonb, now() - interval '6 hours'
  from book_files bf join books b on b.id = bf.book_id cross join app_users u
 where b.title = '声之来信' and lower(u.username) = 'curator'
on conflict (id) do update set target_path = excluded.target_path, outcome = excluded.outcome, occurred_at = excluded.occurred_at;

insert into audit_events(id, actor_id, event_type, subject_type, subject_id, source_path, target_path,
                         before_fingerprint, after_fingerprint, outcome, detail, occurred_at)
select '70000000-0000-4000-8000-000000000002', u.id, 'METADATA_WRITTEN', 'BOOK_FILE', bf.id::text,
       bf.relative_path, bf.relative_path, bf.fingerprint, bf.fingerprint, 'SUCCEEDED',
       '{"source":"demo-seed","currentFileOverwritten":true}'::jsonb, now() - interval '1 day'
  from book_files bf join books b on b.id = bf.book_id cross join app_users u
 where b.title = '山川与灯火' and lower(u.username) = 'owner'
on conflict (id) do update set outcome = excluded.outcome, occurred_at = excluded.occurred_at;

select
  (select count(*) from app_users) as users,
  (select count(*) from books) as books,
  (select count(*) from book_files where status = 'AVAILABLE') as available_files,
  (select count(*) from reading_positions) as reading_positions,
  (select count(*) from annotations) as annotations,
  (select count(*) from recycle_bin_entries where restored_at is null and purged_at is null) as recycle_entries,
  (select count(*) from file_operations) as file_operations;
