#!/usr/bin/env python3
"""Offline, backup-first conversion of a legacy database to the single V1 baseline.
Legacy SQL is supplied from a private release artifact, never shipped as active migrations.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import time
import uuid
import zlib


def checksum(sql):
    value = zlib.crc32(''.join(sql.removeprefix('\ufeff').splitlines()).encode('utf-8'))
    return value if value < 2 ** 31 else value - 2 ** 32


def quote(value):
    return "'" + str(value).replace("'", "''") + "'"


def normalized_schema(data):
    return '\n'.join(line for line in data.decode().splitlines()
                     if line and not line.startswith('--') and not line.startswith('\\'))


class Database:
    def __init__(self, container=None, user=None):
        self.prefix = ['docker', 'exec', '-i', container] if container else []
        self.user = ['-U', user] if user else []

    def run(self, program, args=(), data=None):
        return subprocess.check_output(self.prefix + [program] + self.user + list(args), input=data)

    def sql(self, db, sql):
        return self.run('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-qAt', '-d', db], sql.encode()).decode().strip()

    def schema(self, db):
        # PostgreSQL can deparse equivalent array casts differently after restore.
        # Parse every schema once before comparing; never discard constraint text.
        args = ['--schema-only', '--no-owner', '--no-privileges', '--exclude-table=public.flyway_schema_history']
        raw = self.run('pg_dump', ['-d', db] + args)
        canonical = 'bookkin_schema_' + uuid.uuid4().hex[:12]
        self.run('createdb', [canonical])
        try:
            self.run('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', canonical], raw)
            return normalized_schema(self.run('pg_dump', ['-d', canonical] + args))
        finally:
            self.run('dropdb', ['--if-exists', canonical])

    def counts(self, db):
        present = json.loads(self.sql(db, "select coalesce(json_agg(tablename),'[]') from pg_tables where schemaname='public' and tablename <> 'flyway_schema_history'"))
        return {name: int(self.sql(db, 'select count(*) from public."' + name.replace('"', '""') + '"')) for name in present}



def conversion_sql(history, files):
    if not history or any(not row['success'] or row['type'] != 'SQL' for row in history):
        raise ValueError('Expected a complete successful legacy SQL migration history')
    if [int(row['version']) for row in history] != list(range(1, len(history) + 1)):
        raise ValueError('Legacy migration history is not contiguous')
    if len(history) > len(files):
        raise ValueError('Database is newer than this reviewed legacy bundle')
    for row, path in zip(history, files):
        if row['script'] != path.name or row['checksum'] != checksum(path.read_text()):
            raise ValueError(f'Legacy migration checksum mismatch at version {row["version"]}')
    parts = []
    for rank, path in enumerate(files[len(history):], start=len(history) + 1):
        sql = path.read_text()
        description = path.stem.split('__', 1)[1].replace('_', ' ')
        parts += [sql, "INSERT INTO flyway_schema_history(installed_rank,version,description,type,script,checksum,installed_by,execution_time,success) "
                  f"VALUES ({rank},{quote(rank)},{quote(description)},'SQL',{quote(path.name)},{checksum(sql)},current_user,0,true);"]
    # The final metadata marker skips V1 on this verified, already populated schema.
    marker = ["DELETE FROM flyway_schema_history;", "INSERT INTO flyway_schema_history(installed_rank,version,description,type,script,installed_by,execution_time,success) VALUES (1,'1','Consolidated BookKin schema','BASELINE','<< Flyway Baseline >>',current_user,0,true);"]
    return '\n'.join(parts), '\n'.join(marker)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', required=True)
    parser.add_argument('--container')
    parser.add_argument('--user')
    parser.add_argument('--legacy-dir', type=Path, required=True)
    parser.add_argument('--baseline', type=Path, required=True)
    parser.add_argument('--backup-dir', type=Path, required=True)
    parser.add_argument('--apply', action='store_true', help='Only while app and worker are stopped')
    args = parser.parse_args()
    db = Database(args.container, args.user)
    os.umask(0o077)
    args.backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime('%Y%m%dT%H%M%S') + '-' + uuid.uuid4().hex[:8]
    backup = args.backup_dir / f'pre-baseline-{stamp}.dump'
    files = sorted(args.legacy_dir.glob('V*__*.sql'), key=lambda path: int(path.name.split('__')[0][1:]))
    if len(files) != 30:
        raise ValueError('This consolidation requires the complete reviewed 30-file legacy bundle')
    manifest = json.loads((args.legacy_dir / 'sha256.json').read_text())
    if {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in files} != manifest:
        raise ValueError('Legacy bundle differs from its reviewed manifest')
    history = json.loads(db.sql(args.database, "select json_agg(t order by installed_rank) from (select installed_rank,version,description,type,script,checksum,success from flyway_schema_history) t"))
    upgrade, marker = conversion_sql(history, files)
    sql = upgrade + "\n" + marker
    backup.write_bytes(db.run('pg_dump', ['-d', args.database, '-Fc', '--no-owner', '--no-privileges']))
    rollback_history = db.run('pg_dump', ['-d', args.database, '--data-only', '--column-inserts', '--table=public.flyway_schema_history', '--no-owner', '--no-privileges'])
    (args.backup_dir / f'history-{stamp}.sql').write_bytes(rollback_history)
    clone = 'bookkin_check_' + uuid.uuid4().hex[:12]
    fresh = 'bookkin_fresh_' + uuid.uuid4().hex[:12]
    created = []
    try:
        for name in (clone, fresh):
            db.run('createdb', [name]); created.append(name)
        db.run('pg_restore', ['-d', clone, '--no-owner', '--no-privileges', '--exit-on-error'], backup.read_bytes())
        before = db.counts(clone)
        db.sql(clone, 'BEGIN;\n' + upgrade + '\nCOMMIT;')
        rollback = args.backup_dir / f'rollback-history-{stamp}.sql'
        rollback.write_bytes(db.run('pg_dump', ['-d', clone, '--data-only', '--column-inserts', '--table=public.flyway_schema_history', '--no-owner', '--no-privileges']))
        db.sql(fresh, args.baseline.read_text())
        if db.schema(clone) != db.schema(fresh):
            raise ValueError('Restored/upgraded schema differs from the clean initialization schema')
        upgraded_counts = db.counts(clone)
        if any(upgraded_counts.get(name) != count for name, count in before.items()):
            raise ValueError('Business row counts changed during the restored upgrade')
        for name, count in db.counts(fresh).items():
            if count and name not in {"display_catalog", "catalog_state", "security_settings", "password_policy", "role_permission_policy", "vault_policy", "site_settings"}:
                raise ValueError(f'Initialization unexpectedly contains {name} data')
        result = {'rollbackHistory': str(rollback), 'backup': str(backup), 'backupSha256': hashlib.sha256(backup.read_bytes()).hexdigest(),
                  'baselineSqlSha256': hashlib.sha256(args.baseline.read_bytes()).hexdigest(), 'previousVersion': history[-1]['version'], 'baseline': '1', 'counts': before,
                  'restoredUpgradeVerified': True, 'schemaSha256': hashlib.sha256(db.schema(fresh).encode()).hexdigest(), 'applied': args.apply}
        if args.apply:
            if db.counts(args.database) != before:
                raise ValueError('Database changed during preflight; stop app/worker and retry')
            db.sql(args.database, 'BEGIN;\n' + sql + '\nCOMMIT;')
            final_counts = db.counts(args.database)
            if db.schema(args.database) != db.schema(fresh) or any(final_counts.get(name) != count for name, count in before.items()):
                raise ValueError('Post-conversion verification failed; retain outage and restore the verified backup')
        (args.backup_dir / f'baseline-{stamp}.json').write_text(json.dumps(result, indent=2))
        print(json.dumps(result, indent=2))
    finally:
        for name in reversed(created):
            db.run('dropdb', ['--if-exists', name])


if __name__ == '__main__':
    main()
