# Optional test fixtures

Normal initialization creates an empty database and an empty library. Never run fixtures against the deployed database or production content directories.

`pnpm demo:library` writes optional EPUB fixtures to `.local/fixtures/library`, outside the default `.local/library`. Pass an isolated directory explicitly to override it. Stress fixtures use the same separate location.

Database fixture loading is opt-in: `BOOKKIN_DATABASE_NAME=bookkin_demo pnpm demo:seed --allow-test-data`. The script refuses the normal database name and requires an isolated name ending in `_test` or `_demo`. Create and initialize that test database separately. Fixture code and SQL are not Flyway migrations or application startup tasks.
