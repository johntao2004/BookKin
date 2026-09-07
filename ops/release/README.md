
AI credential encryption uses an instance-specific random 256-bit secret. The
release installer initializes it once in the persistent `.env` (mode 0600), never
prints or rotates it, and refuses to create a replacement when encrypted AI
credentials already exist. Back up this file securely with the database; restore
the same key when recovering the instance. `compose.yaml` must pass
`BOOKKIN_AI_SETTINGS_ENCRYPTION_KEY` to both app and worker.
