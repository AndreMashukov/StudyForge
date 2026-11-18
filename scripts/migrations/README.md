# Migration scripts

Firestore data migrations and backfills. The release pipeline (`.github/workflows/release.yml`) can run them unattended. See `scripts/release/README.md`.

## Contract for a script the pipeline may run

1. **Dry-run by default.** With no flags, the script reads only and prints what it would change.
2. **`--write` applies.** That is the only flag the pipeline passes. Don't make it depend on any other required argument.
3. **Exit code.** Exit 0 only on success. On non-zero, the pipeline stops the release and doesn't record the script, so it retries next release.
4. **Credentials.** Use application default credentials and `GCLOUD_PROJECT`, both of which the pipeline sets.
5. **Idempotent.** It must be safe to re-run after a partial `--write`.
6. **Release phase in the header comment:**

   ```ts
   /**
    * Backfill `expiresAt` on transient records.
    * @release-phase post-functions
    */
   ```

   - `pre-functions` runs before function deploys. Use it when the new function code needs the migrated data.
   - `post-functions` runs after function deploys. Use it when the new code handles both shapes and the backfill can follow.
   - A script with no tag is never run by the pipeline. Run it by hand.

The header is also what the planner LLM reads to decide whether this release needs the script, so describe what it changes and which feature it supports.

## Migration ledger

Firestore `_releaseMigrations/{scriptFile}` records every script that has been applied. A script with a ledger entry never runs again. Scripts that existed before the ledger were seeded as `pre-ledger-seed` (`yarn release:seed-ledger --write`).

If you run a script by hand, the pipeline doesn't know about it. If it's tagged, it may run again. Add a ledger entry, or merge the script untagged.
