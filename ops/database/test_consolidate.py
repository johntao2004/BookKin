import tempfile
from pathlib import Path
import unittest
from consolidate import checksum, conversion_sql, normalized_schema


class ConsolidationTest(unittest.TestCase):
    def test_rejects_modified_legacy_before_any_sql_is_applied(self):
        with tempfile.TemporaryDirectory() as folder:
            first = Path(folder) / 'V1__initial_schema.sql'
            first.write_text('CREATE TABLE original(id integer);')
            row = {'version': '1', 'script': first.name, 'checksum': 123, 'success': True, 'type': 'SQL'}
            with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
                conversion_sql([row], [first])

    def test_applies_only_pending_ddl_and_creates_single_baseline_marker(self):
        with tempfile.TemporaryDirectory() as folder:
            first = Path(folder) / 'V1__initial_schema.sql'
            second = Path(folder) / 'V2__extra_column.sql'
            first.write_text('CREATE TABLE original(id integer);')
            second.write_text('ALTER TABLE original ADD COLUMN label text;')
            row = {'version': '1', 'script': first.name, 'checksum': checksum(first.read_text()), 'success': True, 'type': 'SQL'}
            upgrade, marker = conversion_sql([row], [first, second])
            self.assertNotIn('CREATE TABLE original', upgrade)
            self.assertIn('ADD COLUMN label', upgrade)
            self.assertIn("'BASELINE'", marker)
            self.assertIn('DELETE FROM flyway_schema_history', marker)
            row['success'] = False
            with self.assertRaises(ValueError):
                conversion_sql([row], [first, second])

    def test_dump_comparison_ignores_only_dump_comments_and_client_restrictions(self):
        self.assertEqual(normalized_schema(b'-- dump\n\\restrict abc\nCREATE TABLE x(id int);\n'), 'CREATE TABLE x(id int);')
        self.assertNotEqual(normalized_schema(b'CREATE TABLE x(id int);'), normalized_schema(b'CREATE TABLE x(id text);'))


if __name__ == '__main__':
    unittest.main()
