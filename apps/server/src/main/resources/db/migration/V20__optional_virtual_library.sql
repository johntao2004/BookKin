-- 保留升级前的可用性；Preserve availability when upgrading existing libraries.
UPDATE site_settings
SET settings = settings || '{"virtualLibraryEnabled":true}'::jsonb
WHERE NOT jsonb_exists(settings, 'virtualLibraryEnabled');
