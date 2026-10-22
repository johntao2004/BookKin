# Single initialization baseline

The application contains exactly one Flyway file: `V1__initial_schema.sql`. It creates the complete current schema and seven system-setting rows. It contains no users, books, articles, notes, reading activity, library registrations or reusable credentials. Optional sample books and database fixtures are isolated under the explicit test tooling.

Existing databases must **not** be pointed directly at the consolidated application. Their historical V1 checksum differs. Do not disable Flyway validation, use repair blindly, reset the database, or delete content to get past this boundary.

For the 2026-10-23 transition, the exact old V1–V30 SQL and their SHA-256 manifest were preserved in a private release artifact before consolidation. They are not active application migrations or duplicated initialization versions. Preserve this artifact with the private release backups; never substitute SQL from another release. Existing Git history remains unchanged.

`consolidate.py` validates every installed legacy checksum, makes a PostgreSQL custom-format backup, restores it into a uniquely named disposable database, applies only pending legacy changes, and compares its full schema with a clean V1 database. It compares all pre-existing table row counts and verifies the new database has no business rows. It creates rollback Flyway-history SQL from the fully upgraded clone. These checks run before any live database mutation. Files are private (umask 077); temporary databases are removed on success or failure.

Preflight (use the correct container/user and private legacy artifact):

```sh
python3 consolidate.py --container bookkin-postgres-1 --user bookkin \
  --database bookkin --legacy-dir /private-release/legacy \
  --baseline /private-release/V1__initial_schema.sql --backup-dir /private-backups
```

For conversion, stop both app and worker, repeat with `--apply`, then start the verified candidate. The complete upgrade and replacement of Flyway history with one V1 baseline marker run in a transaction. No application tables or original files are dropped. Keep the successful receipt and its `rollbackHistory` with the backups. The reviewed installer accepts this transition only with `--consolidated-baseline <receipt>` and the exact candidate SQL hash.

If application verification fails, stop the candidate, restore the receipt's rollback history in a transaction, and restart the previous image. Added tables remain intact; the old app ignores future migration records. If data/schema verification itself fails after commit, keep app/worker stopped and restore the already verified database backup. Never reuse the old app against a consolidated history marker without restoring its history first. Backups of the library, fonts, article/vault directories and instance keys remain separate requirements.
