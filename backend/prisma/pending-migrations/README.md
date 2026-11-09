# Pending migrations

Migrations in this folder are **not** applied by `prisma migrate deploy`, because Prisma only
reads `prisma/migrations`. They are destructive and must only run once their preconditions hold.

## `20261107000000_drop_plaintext_personal_data`

Drops the plaintext columns of `Family`, `Child` and `Caregiver` that the org encryption
replaced with the encrypted `encrypted` blob. The typed answer columns stay: forms without
personal data still use them.

### Preconditions

1. Every organisation has set up its encryption (no `keyState = 'uninitialized'`).
2. In every organisation a coordinator ran **Schlüsselverwaltung → Bestandsdaten verschlüsseln**
   until it reported nothing left.

The migration checks both itself and aborts without changing anything if they don't hold.

Encryption is optional per organisation, so this migration is only for an installation where
every organisation chose to activate it. As long as one organisation works without encryption,
its data lives in these columns: leave the migration here.

### Applying it

1. Back up the database.
2. Move the folder into `backend/prisma/migrations/`.
3. In `backend/prisma/schema.prisma`, remove the dropped fields:
   - `Family`: `name`, `note`, `adress`, `phone`, `additionalPhones`
   - `Child`: `name`, `lastName`, `gender`, `healthData`, `dateOfBirth`
   - `Caregiver`: `name`, `lastName`, `relation`, `gender`, `dateOfBirth`
4. Run `npx prisma generate` and fix the compile errors: they are exactly the legacy
   plaintext paths, which can go (`shared/api/family.ts` picks, the plaintext branches in
   `familyController.ts`, `CaseController.create`, `encryptedRows.ts` migration mode,
   `clearedBlobFields`, and the frontend's legacy pass-through in `PersonalDataService`).
5. `npx prisma migrate deploy`.

Plaintext also remains in database backups taken before the migration; it is gone once they
expire under the backup retention policy (`backup.sh`).
