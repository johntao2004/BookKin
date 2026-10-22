#!/usr/bin/env python3
"""Seed assistant-authored, excerpt-backed graph fixtures into a LOOPBACK dev DB only.
Requires the four generated EPUBs to have been imported normally first.
Does not change book files, permissions, settings, or any reading data.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from uuid import uuid4
import xml.etree.ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / '.local/knowledge-test-books'
PROVIDER = 'local-test-assistant-authored-v1'
CONCEPTS = [
    [('光合作用',), ('碳循环',), ('生物多样性',)],
    [('光合作用',), ('碳循环',), ('生物多样性', '样方调查')],
    [('生物多样性',), ('富营养化',), ('溶解氧', '光合作用')],
    [('线装',), ('纸张酸化',), ('温湿度监测',)],
]
def literal(value):
    return "'" + value.replace("'", "''") + "'"

manifest = json.loads((DIRECTORY / 'manifest.json').read_text())
assert len(manifest) == 4
fixtures = []
for book, concepts in zip(manifest, CONCEPTS):
    path = DIRECTORY / Path(book['file']).name
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    assert digest == book['sha256']
    points = []
    with ZipFile(path) as epub:
        for chapter, names in enumerate(concepts, 1):
            locator = f'OEBPS/c{chapter}.xhtml'
            doc = ET.fromstring(epub.read(locator))
            paragraph = ''.join(doc.find('.//{*}p').itertext())
            for name in names:
                # Preserve one exact continuous sentence, never synthesize evidence.
                quote = next(sentence + '。' for sentence in paragraph.split('。') if name in sentence)
                assert 2 <= len(name) <= 60 and 12 <= len(quote) <= 300
                assert quote in paragraph and name in paragraph
                points.append({'name': name, 'quote': quote, 'locator': locator})
    fixtures.append({'title': book['title'], 'fingerprint': 'sha256:' + digest, 'points': points})
(DIRECTORY / 'knowledge-fixtures.json').write_text(json.dumps(fixtures, ensure_ascii=False, indent=2) + '\n')
print('Validated 4 books / 14 sourced points / 9 distinct concepts; provider=' + PROVIDER)
if '--apply' not in sys.argv:
    print('Dry run. Pass --apply to insert into the local development database.')
    sys.exit(0)
host = os.getenv('BOOKKIN_DATABASE_HOST', '127.0.0.1')
if host not in ('127.0.0.1', 'localhost', '::1'):
    raise SystemExit('Only loopback development database hosts are allowed.')
env = dict(os.environ, PGPASSWORD=os.getenv('BOOKKIN_DATABASE_PASSWORD', 'bookkin-local-dev'))
command = ['psql', '-X', '-h', host, '-p', os.getenv('BOOKKIN_DATABASE_PORT', '5432'), '-U', os.getenv('BOOKKIN_DATABASE_USER', 'bookkin'), '-d', os.getenv('BOOKKIN_DATABASE_NAME', 'bookkin'), '-v', 'ON_ERROR_STOP=1']
statements = ['BEGIN;', 'SET LOCAL lock_timeout = \'5s\';', 'SET LOCAL statement_timeout = \'15s\';']
for fixture in fixtures:
    title, fingerprint = map(literal, [fixture['title'], fixture['fingerprint']])
    points = literal(json.dumps(fixture['points'], ensure_ascii=False))
    # Hash + title match only the exact test artifacts. No overwrite of other analysis.
    statements.append(f'''DO $test$
    BEGIN
      IF (select count(*) from books b join book_files f on f.book_id=b.id where b.title={title} and f.fingerprint={fingerprint} and f.status='AVAILABLE') <> 1 THEN
        RAISE EXCEPTION 'Import the exact EPUB fixture first';
      END IF;
      IF EXISTS(select 1 from book_knowledge k join books b on b.id=k.book_id where b.title={title} and (k.provider_id is distinct from {literal(PROVIDER)} or k.fingerprint <> {fingerprint} or k.status='GENERATING')) THEN
        RAISE EXCEPTION 'Refusing to overwrite other or active knowledge analysis';
      END IF;
    END $test$;''')
    statements.append(f'''insert into book_knowledge(book_id,file_id,fingerprint,status,operation_id,provider_id,sampled_sections,total_sections,generated_at,points)
    select b.id,f.id,f.fingerprint,'READY','{uuid4()}',{literal(PROVIDER)},3,3,now(),{points}::jsonb
    from books b join book_files f on f.book_id=b.id where b.title={title} and f.fingerprint={fingerprint} and f.status='AVAILABLE'
    on conflict(book_id) do nothing;''')
statements.append('COMMIT;')
subprocess.run(command, input='\n'.join(statements), text=True, env=env, check=True)
print('Inserted local test fixtures. No AI provider was called.')
