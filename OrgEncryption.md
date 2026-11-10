# Org encryption: how it walks through the code

Personal data in FamDok is encrypted and decrypted only in the browser, under a key that only
the organisation holds. The server and the database store ciphertext, public keys and wrapped
keys, never a passphrase, a private key or an org data key. This document follows that through
the code for four use cases:

1. [A new organisation is added](#1-a-new-organisation-is-added)
2. [A new user is added to an organisation](#2-a-new-user-is-added-to-an-organisation)
3. [A user reads and writes encrypted data](#3-a-user-reads-and-writes-encrypted-data)
4. [A user's passphrase was exposed](#4-a-users-passphrase-was-exposed)

It ends with how a browser decides which key versions to trust, existing data, recovery, what
the operator can see, and operational notes.

---

## Terms

| Term | Meaning |
|---|---|
| **DEK** (data encryption key) | The org's AES-256-GCM key that encrypts personal fields. Versioned (`Organisation.keyVersion`). |
| **User key pair** | ECDH P-256. Public key stored in plaintext (`UserKey.publicKey`), private key stored wrapped (`UserKey.wrappedPrivateKey`). |
| **Passphrase** | The user's encryption passphrase. Not the Keycloak password; never leaves the browser. |
| **KEK** (key encryption key) | Derived from the passphrase with Argon2id. Wraps the private key. |
| **Grant** | The DEK of one version, sealed with HPKE (RFC 9180) to one user's public key (`OrgKeyGrant.wrappedKey`). |
| **Recovery code** | 160 random bits, printed and kept offline. Wraps the DEK as `Organisation.recoveryWrappedKey` (during a rotation, the new DEK under the new code as `Organisation.pendingRecoveryWrappedKey`). |
| **Envelope** | One encrypted value: `v1.<keyVersion>.<iv>.<ciphertext>`. |
| **AAD** (additional authenticated data) | `<table>:<rowId>:<field>`, mixed into AES-GCM so a ciphertext only decrypts in the row and field it was written for. |
| **Fingerprint** | SHA-256 of a public key (or, with a domain prefix, of a DEK) as six groups of five digits, compared out of band. |
| **Continuity proof** | For every key version after the first: the new DEK's fingerprint, encrypted under the previous DEK (`OrgKeyProof`). Proves the new version was made by someone holding the old key. |
| **Key pin** | What a browser remembers per org in localStorage: the highest key version it trusted and that version's fingerprint. |
| **Key manager** | A role that grants the DEK, freezes the org and rotates the key: OrgCoordinator and OrgController (`KEY_MANAGER_ROLES`). "Coordinator" below means either. |
| **Key holders** | Roles that get a key pair and a grant (`ROLES_NEEDING_KEYS`): User, SubOrgCoordinator, OrgCoordinator, OrgController. Admin and Controller never hold the DEK. |

### Key hierarchy

```
passphrase ──Argon2id──▶ KEK ──unwraps──▶ user private key ──opens──▶ grant ──▶ DEK v(n)
recovery code ──HKDF──▶ recovery key ──unwraps──▶ recoveryWrappedKey ──────────▶ DEK v(n)
DEK ──AES-256-GCM + AAD──▶ personal fields, attachment contents
```

### Where the code lives

| Concern | File |
|---|---|
| Text and binary formats (`v1.`, `k1.`, `g1.`, `r1.`, `FDK1`), AAD, grant info | `shared/utils/ciphertext.ts` |
| Which models and columns are encrypted, AAD contexts | `shared/utils/encryptedModels.ts` |
| Recovery codes, fingerprints | `shared/utils/recoveryCode.ts` |
| `/keys` request and response types | `shared/api/keys.ts` |
| All cryptography (AES-GCM, ECDH, HPKE, recovery) | `frontend/src/app/services/crypto.service.ts` |
| Argon2id, KDF parameters | `frontend/src/app/util/crypto/kdf.ts`, `kdf.worker.ts`, `services/kdf.service.ts` |
| Keys of the current tab, enrol/unlock/setup/recover | `frontend/src/app/services/key-session.service.ts` |
| Key pins and the decision which key versions to trust (`checkKeyChain`) | `frontend/src/app/util/crypto/keyPins.ts` |
| Encrypting requests, decrypting responses | `frontend/src/app/services/personal-data.service.ts` |
| Filters on personal fields | `frontend/src/app/util/crypto/clientFilters.ts` |
| Browser-side PDF and ZIP export | `frontend/src/app/services/export.service.ts` |
| Migration and rotation job | `frontend/src/app/services/reencrypt-job.service.ts` |
| Pages | `pages/encryption` (`/verschluesselung`), `pages/key-management` (`/schluesselverwaltung`), `pages/key-migration`, `pages/key-rotation` |
| Route guard | `frontend/src/app/auth/guards/encryptionGuard.ts` |
| Key endpoints | `backend/routes/keyRouter.ts`, `backend/controller/KeyController.ts`, `backend/controller/authFns/KeyAuthFns.ts` |
| Ciphertext-only checks on data writes | `backend/util/encryptionPolicy.ts` |
| Rotation and migration row selection | `backend/util/encryptedRows.ts` |
| Frozen-org middleware | `backend/middleware/orgFrozen.ts` |
| Schema | `backend/prisma/schema.prisma` (`UserKey`, `OrgKeyGrant`, `OrgKeyEvent`, `OrgKeyProof`, `Organisation.keyState` …) |

### What is encrypted

| Model | Storage | Columns |
|---|---|---|
| Family | blob in `encrypted` | name, note, adress, phone, additionalPhones |
| Child | blob in `encrypted` | name, lastName, gender, dateOfBirth, healthData |
| Caregiver | blob in `encrypted` | name, lastName, gender, dateOfBirth, relation |
| Case | field | specificMigrationBackground |
| ContactDocumentation | field | zusammenfassung, dokumentation |
| Zielvereinbarung | field | description (`topic` is a category and stays plaintext) |
| Handover | field | notes |
| CaseAttachment | field + file | filename, note; file content as `FDK1` bytes |
| Answer (forms with `containsPersonalData`) | blob in `answerEncrypted` | the typed answer columns |

Statistics fields stay plaintext by design: dates, durations, topics, `artDerBetreuung`, and
`Case.city`/`Case.plz`, which the browser copies from the (encrypted) address.

Rows holding ciphertext get their id from the browser (`PersonalDataService.newId`), because the
AAD binds the ciphertext to that id before the row exists. Answers are bound to
`Answer:<responseId>:<questionId>` instead (see `encryptionContext`), so answer rows need no
browser-chosen ids.

---

## 1. A new organisation is added

Org state: `uninitialized` → `active`.

**Encryption is off unless the server enables it.** The backend offers it only with
`ORG_ENCRYPTION_ENABLED=true` (`backend/config.ts`, default off). Without it:

- only `GET /keys/me` exists (`DisabledKeyRouter`); it reports `enabled: false`, and every other
  `/keys` route answers 404;
- `KeySessionService` goes to the state `disabled`: no key state in the header, no
  "Verschlüsselung" or "Schlüsselverwaltung" menu entries (`MenuComponent` reads
  `encryptionEnabled`), the encryption pages redirect home (`encryptionFeatureGuard`), and
  `PersonalDataService` passes everything through in plaintext;
- a browser that has seen its org encrypted doesn't believe a server that reports the encryption
  as off and goes to `keyMismatch`, as for an org reported as `uninitialized`.

**Turning the server option off is a one-way street as well.** Once any organisation has
activated its encryption, its data can only be read and written with the encryption features, so
`ORG_ENCRYPTION_ENABLED` must stay on. `assertEncryptionConfig` (`backend/util/encryptionConfig.ts`)
checks this at startup: with the option off and any organisation not `uninitialized`, the backend
refuses to start and names those organisations.

**Encryption is optional per organisation.** An org that never activates it keeps working in
legacy mode indefinitely; nothing in the app requires it. Activation is a deliberate step by a
key manager and is one-way:

- There is no endpoint that switches an org back to `uninitialized`; `setupOrg` only runs on an
  uninitialized org, and nothing else writes `keyState = uninitialized`.
- Going back would mean decrypting every value in a key manager's browser and storing plaintext
  again. That isn't implemented.
- Resetting `keyState` in the database doesn't work either: every browser that has seen the org
  encrypted refuses to write plaintext (`hasSeenEncryption` → `keyMismatch`).

The UI says so wherever activation is offered: `EncryptionOptInComponent` (on
`/schluesselverwaltung` and the setup on `/verschluesselung`) explains the consequences, the
setup only starts after the key manager ticks "Ich habe verstanden, dass die Verschlüsselung …
nicht wieder abgeschaltet werden kann", and the final upload waits for one more confirmation
dialog. Until activation, members aren't asked for anything: the header shows no key state, the
"Verschlüsselung" menu entry is hidden (`MenuComponent` reads
`KeySessionService.encryptionActive`), and `/verschluesselung` tells them there is nothing to do.

1. **Admin creates the org.** `OrgController.createOrg` creates the `Organisation` row; the schema
   defaults are `keyState = uninitialized`, `keyVersion = 0`. Until it is set up, the org works in
   *legacy mode*: data is stored as before, in plaintext. `encryptionPolicyFor` reports
   `active: false`, and `PersonalDataService.send` passes requests through unchanged.

2. **Admin creates the first OrgCoordinator** (or OrgController) in the user admin (`UserController.create`), which
   creates the Keycloak account and sends the invite.

3. **The coordinator logs in.** `HeaderComponent` calls `KeySessionService.ensureLoaded`, which
   fetches `GET /keys/me` (`KeyController.getStatus`). Org `uninitialized` and no `UserKey` →
   state `orgNotSetUp`. Since `status.canManageKeys` is true, "Schlüsselverwaltung" (in the menu
   right under "Benutzerverwaltung") shows the org as "Nicht aktiviert (optional)" with the
   explanation and a link to `/verschluesselung` (`EncryptionPage`), which offers the setup after
   the acknowledgement above.

4. **Coordinator key pair.** The coordinator picks a passphrase (`PassphraseInputComponent`,
   rated by `PassphraseStrengthService` with zxcvbn-ts; at least 12 characters and score 3).
   `KeySessionService.enrol`:
   - `CryptoService.generateUserKeyPair` → ECDH P-256
   - `newKdfParams()` → random salt, Argon2id 64 MiB / 5 iterations
   - `KdfService.deriveKek` → Argon2id in `kdf.worker.ts`, then `importKek` (non-extractable,
     `wrapKey`/`unwrapKey` only)
   - `CryptoService.wrapPrivateKey` → `k1.<iv>.<ct>`, AAD `famdok-userkey-v1:<userId>`
   - `PUT /keys/me` → `KeyController.enrol` validates the formats (`UserKeyRequest`: P-256
     SPKI, `k1.`, KDF bounds), stores `UserKey` and logs an `enrol` event with the fingerprint
     (`publicKeyFingerprint`).
   - The session keeps a non-extractable unwrapped copy of the private key.

5. **Org key.** "Schlüssel der Organisation erzeugen" → `KeySessionService.prepareOrgSetup`:
   - `generateDataKey` → DEK v1 (extractable, only for these two steps)
   - `sealGrant(dek, ownPublicKey, {orgId, keyVersion: 1})` → HPKE
     DHKEM(P-256)/HKDF-SHA256/AES-256-GCM, `info = famdok-grant-v1:<orgId>:1`, as `g1.<enc>.<ct>`
   - `generateRecoveryCode` + `sealRecovery` → HKDF from the code, AES-GCM with AAD
     `famdok-recovery-v1:<orgId>:1`, as `r1.1.<iv>.<ct>`
   Nothing is uploaded yet. The page shows the recovery code once.

6. **Confirm and activate.** The coordinator types the code back (`recoveryConfirmed`) and
   confirms the dialog "Verschlüsselung endgültig aktivieren?", then `commit()` → `POST /keys/orgs/:orgId/setup` → `KeyController.setupOrg`:
   `updateMany where keyState = uninitialized` sets `active`, `keyVersion 1` and
   `recoveryWrappedKey`, creates the self-grant, logs `setup`. The `where` makes a second setup
   impossible, so an operator can't quietly re-key an active org.

7. **Unlocked.** `refresh` → `openGrants` opens the self-grant (`openGrant` → non-extractable
   DEK plus its fingerprint), `checkKeyChain` trusts version 1 as the first key this browser
   sees and `writeKeyPin` remembers `{keyVersion: 1, fingerprint}` in localStorage, state
   `unlocked`. From now on every write in this org must be ciphertext.

8. **Existing data** from before step 6 is still plaintext; see
   [Existing data](#existing-data-migration).

---

## 2. A new user is added to an organisation

User state: invited → awaiting access → active.

1. **The coordinator creates the user** in `/user-admin` (`UserController.create`, unchanged).
   There is no grant yet: the user has no public key.

2. **The user's first login.** `getStatus` → org `active`, no `UserKey` → state
   `needsEnrolment`. The `encryptionGuard` on every page with personal data redirects to
   `/verschluesselung?returnUrl=…`.

3. **Key pair.** Same as step 4 above: `KeySessionService.enrol` → `PUT /keys/me`. The page shows
   the user's fingerprint (`CryptoService.publicKeyFingerprint`, computed in the browser). State
   `awaitingGrant`.

4. **The coordinator sees the user waiting.** `/schluesselverwaltung` (`KeyManagementPage`) loads
   `GET /keys/orgs/:orgId/members` (`KeyController.getMembers`) and computes each member's
   fingerprint **locally** from their public key: the server's version is never shown, so a
   swapped key would show a different number.

5. **Fingerprint check and grant.** The coordinator compares the fingerprint with the user in
   person or by phone, then confirms "Freigeben" → `KeyManagementPage.doGrant`:
   - `CryptoService.regrant(ownGrant, ownKeyPair, userPublicKey, ctx)`: opens the coordinator's
     own grant to raw bytes, seals them to the user, wipes the bytes. The coordinator's session
     DEK stays non-extractable throughout.
   - `POST /keys/orgs/:orgId/grants` → `KeyController.grant` checks: coordinator of this org,
     current key version, the user belongs to the org, has a role that reads personal data
     (`roleNeedsKeys`), and **still has the public key the grant was sealed to** (otherwise 409).
     Logs `grant` with the fingerprint.

6. **The user unlocks.** "Erneut prüfen" → `refresh` → `openGrants` → state `unlocked`, and the
   guard lets them through to `returnUrl`. This first key is trusted on first use and pinned;
   the page shows the org key fingerprint (`orgKeyFingerprint`), which the user can compare with
   the coordinator's, as the coordinator compared theirs.

Later logins: `getStatus` → state `locked` → passphrase → `KeySessionService.unlock`
(derive KEK, `unwrapPrivateKey`, `openGrants`; see [Which key versions a browser
trusts](#which-key-versions-a-browser-trusts)). A wrong passphrase surfaces as
`WrongPassphraseError`. Keys live only in the tab's memory; reload, logout
(`HeaderComponent.logout` → `lock()`) or the lock button discard them.

Forgotten passphrase: the passphrase can't be reset. `EncryptionPage` offers a new key pair
(`enrol` with `replace: true`); `KeyController.enrol` then deletes the user's grants, and the
coordinator checks the new fingerprint and grants again.

---

## 3. A user reads and writes encrypted data

### Reading

Every service that loads personal data pipes the response through
`PersonalDataService.decrypting(model)`:

```
CaseService.getCase(id)
  → GET /case/i/:id                       (server returns ciphertext)
  → PersonalDataService.decrypt('Case', c)
       walks RELATIONS: Case → family → children/caregiver,
                        contactDocumentation, zielvereinbarungen, attachments, …
       blob models:   decryptJson(row.encrypted, keyResolver, Family:<id>:encrypted)
                      → merge fields back (name, adress, … as before)
       field models:  decryptField(row.col, keyResolver, <Model>:<id>:<col>)
       answers:       decryptJson(answerEncrypted, …, Answer:<responseId>:<questionId>)
  → components receive the same plaintext shapes as before
```

- `keyResolver` (`KeySessionService`) maps the key version in each envelope to the session's DEK.
- A value that doesn't decrypt (locked, no grant, moved to another row or tampered) becomes
  `[verschlüsselt]` (`UNREADABLE`) instead of breaking the page.
- Rows from before the migration still hold plaintext and pass through unchanged.
- Services: `CaseService`, `FamilyService`, `ContactDocumentationService`, `CaseFormService`.

**Filtering and search on personal fields** can't run on the server. In encrypted orgs the
services split those filters off the request and apply them to the decrypted results
(`clientFilters.ts`): the family name filter (`splitCaseWhere`), the documentation text filter
(`splitContactDocumentationWhere`), and answer filters (`splitResponseWhere`).

**Exports** (`ExportService`) load the case, documentation and responses through the same
services and build the Stammdaten PDF, contact documentation PDFs and the case ZIP in the browser
(pdfmake and JSZip, loaded on first use). The server-side export endpoints are gone.

**Attachments**: `CaseService.downloadAttachment` fetches the stored bytes and
`PersonalDataService.decryptAttachmentContent` decrypts them (`decryptBytes`, AAD
`CaseAttachment:<id>:content`) before the save dialog; the file name was decrypted with the list.

### Writing

Every write goes through `PersonalDataService.send(plain, prepare, send)`: in legacy orgs it sends
`plain` unchanged, otherwise `prepare` encrypts it first.

| Action | Service | Preparation |
|---|---|---|
| New case and family | `CaseService.createCase` | `prepareCaseCreate`: new ids for case, family, children, caregivers; blobs; `specificMigrationBackground`; copies `city`/`plz` |
| Edit family | `FamilyService.updateFamily` | loads the current family, `prepareFamilyUpdate` merges and re-encrypts the whole blob |
| Health data | `FamilyService.updateHealthData` | loads the child, `prepareHealthData` re-encrypts its blob |
| Contact documentation | `ContactDocumentationService.create/updateDocumentation` | `prepareContactDocumentation`; empty text becomes `null` |
| Zielvereinbarung | `CaseService.addZiel/updateZiel` | `prepareZiel` |
| Handover | `CaseService.handover` | `prepareHandover` |
| Form response | `CaseFormService.saveResponse` | loads the form; for `containsPersonalData`, `prepareAnswers` encrypts each non-empty answer |
| Attachment | `CaseService.uploadAttachment` | `prepareAttachment`: content as `FDK1`, file name and note as envelopes, real mime type alongside |

On the server, each data controller first loads the org's policy and checks the write:

```
CaseController.createContactDocumentation(user, caseId, input)
  → canEditCase(...)                                   (unchanged authorization)
  → encryptionPolicyFor(case.organisationId)           (active? which key version?)
  → assertClientId(policy, input.id, …)                (browser-chosen UUID)
  → assertFieldWrite(policy, 'ContactDocumentation', input)
       every encrypted column: null or a v1. envelope under the current key version
  → prisma.contactDocumentation.create(...)
```

`assertBlobWrite` additionally refuses any plaintext personal field next to a blob, and writing a
blob clears plaintext left over from before the migration (`clearedBlobFields`).
`assertAnswersWrite` does the same for answers. Encrypted attachment uploads are checked for the
`FDK1` header under the current key version (`readHeader` in `CaseController`), otherwise the
stored file is deleted and the upload refused.

Warnings keep working: they only check whether fields are empty, and the browser sends `null` for
empty values, so an envelope always means "filled in".

---

## 4. A user's passphrase was exposed

Assume whoever has the passphrase can derive the KEK, unwrap the private key from the server's
copy and open the user's grant, so they may hold the DEK.

1. **Disable the user.** In the user admin, locking the account calls
   `UserController.setEnabled(false)`: it disables the Keycloak account, ends its sessions
   (`users.logout`) and calls `KeyController.removeUserKeys`, which deletes the user's grants and
   `UserKey` and logs a `revoke`. A grant can also be removed on its own via
   `/schluesselverwaltung` → "Entziehen" (`KeyController.revoke`).

2. **Freeze the org.** `/schluesselverwaltung` → "Einfrieren" → `POST /keys/orgs/:orgId/freeze`
   (`KeyController.freeze`; coordinators of the org, or the Admin in an emergency). From the next
   request on, `requireOrgNotFrozen` answers 423 for `/family`, `/case`, `/case-form-response` and
   `/warnings` for every member. The `httpErrorInterceptor` refreshes the key session on a 423, and
   members see the `frozen` state.

3. **Rotate** (`/schluesselverwaltung/erneuern`, `KeyRotationPage`):
   - **Prepare**: `generateDataKey` → DEK v(n+1); `sealGrant` to the coordinator's own public key;
     the continuity proof `sealKeyProof(fingerprintDataKey(DEK n+1), DEK n, …)`, an envelope under
     version n with AAD `OrgKey:<orgId>:v<n+1>` (`keyProofContext`); a new recovery code and
     `sealRecovery(DEK n+1, code, …)`. Nothing is uploaded until the coordinator has typed the new
     code back.
   - **Start**: `POST /keys/orgs/:orgId/rotation/start` (`KeyController.startRotation`, only on a
     frozen org, only version n+1, proof under version n, recovery key for n+1) sets `rotating`
     and `pendingKeyVersion`, stores the new recovery key as `pendingRecoveryWrappedKey`, the grant
     and the `OrgKeyProof`. The state change is a conditional update (`keyState = frozen`, still on
     version n), so of two concurrent starts only one goes through. Because the own grant is
     stored first, an interrupted rotation can resume after a reload.
   - **Re-encrypt**: `ReencryptJobService.run(orgId, 'rotation', newKey, keyResolver)` fetches
     batches from `GET …/rotation/rows` (`findPending`: rows of this org with an envelope not yet
     under n+1), `rotateRow` decrypts each value with the old key and encrypts it with the new one
     in the same AAD context, and `PUT …/rotation/rows` (`storeReencrypted`) accepts only
     envelopes under n+1, only in encrypted columns, only for rows of this org. Attachment
     contents go through `…/rotation/attachments/:id/content`.
   - **Resume without the own grant**: if the coordinator loses access mid-rotation (forgotten
     passphrase, re-enrolment, revoked or disabled account), the new key is not lost with their
     grant. Any key manager recovers it on the rotation page with the new code, and the old key
     with the old code if they don't hold it (`KeySessionService.recover`; while rotating,
     `KeyController.grant` accepts the current and the pending version), and continues.
   - **Complete**: `regrant` to every member who held version n **with the same public key**
     (their fingerprint was checked then; the disabled user has no grant any more). Then
     `POST …/rotation/complete` (`KeyController.completeRotation`) checks that nothing is left
     under version n (`countPending` + attachment contents) and that version n+1 has a proof,
     stores the new grants, makes `pendingRecoveryWrappedKey` the `recoveryWrappedKey` (the old
     code stops working), sets `keyVersion = n+1` and unfreezes the org.
     Members who got the new version keep their older grants, because their browsers need the
     old key to check the proof; everyone else loses all of theirs.

4. **Everyone else continues.** Members unlock as usual. `openGrants` opens versions n and n+1,
   `verifyKeyProof` checks the proof with DEK n, and `checkKeyChain` accepts n+1 because it links
   to the pinned version n. `EncryptionPage` tells them the key was renewed, with the new org key
   fingerprint.

5. **The affected user re-enrols** with a new key pair and passphrase (their old `UserKey` is
   gone), and a coordinator checks the new fingerprint before granting (use case 2, step 5).

**Limits.** Rotation protects the database from now on. A copy of the database taken before the
rotation can still be decrypted with the old key, so old backups have to expire under the backup
policy. If only the Keycloak password leaked, none of this is needed: the attacker sees only
ciphertext; reset the password and end the sessions.

If a **coordinator** was compromised, another coordinator does the same and also reviews the key
log (`GET /keys/orgs/:orgId/events`, shown on `/schluesselverwaltung`) for grants the
compromised coordinator made. If no trustworthy coordinator is left, the org uses the recovery
code (below).

---

## Which key versions a browser trusts

The server hands over the grants, so it decides which keys a browser *could* use. The browser
decides which ones it *will* use. `GET /keys/me` returns all of the user's grants in the org and
all continuity proofs; `KeySessionService.openGrants` then:

1. opens every grant sealed to the user's current public key;
2. checks each proof `v` with `CryptoService.verifyKeyProof`: decrypts it with DEK `v-1` in the
   context `OrgKey:<orgId>:v<v>` and compares the result with DEK `v`'s fingerprint. A proof that
   doesn't decrypt, or names another key, simply doesn't count;
3. calls `checkKeyChain` (`keyPins.ts`, pure). The anchor is the pinned version, or in a browser
   without a pin the oldest version the user holds. From there a version is trusted only through
   verified proofs. It refuses a current version below the pin (rollback), a pinned version
   that now has another fingerprint (swap), a pinned version the user no longer holds (nothing to
   check against), and a current version outside the chain (a key nobody holding the old one
   made);
4. keeps only the trusted keys in the session. On refusal it keeps none at all, the state is
   `keyMismatch`, nothing is decrypted or written, and `presentedKey` holds the fingerprint of the
   key the server offers. After comparing that fingerprint with a coordinator, the user can accept
   it ("Schlüssel übernehmen" → `acceptPresentedKey`, which pins it).

A pending version (during a rotation) is used only once its proof verified, so the coordinator
running the rotation can read and write under it and nobody else is offered a forged one.

**Why this matters.** Without proofs, someone with database access could insert a "version n+1"
of their own: grants sealed to each member's public key (which are public), `keyVersion = n+1`,
and `pendingKeyVersion = n` so old data still decrypts. Browsers would accept the higher version
and every value written afterwards would be readable by the operator. The proof needs DEK n,
which the operator never has; a forged version fails step 3.

The legitimate case that needs the manual accept: a user who re-enrolled (forgotten passphrase)
after their browser pinned an older version. Their old grants are gone with the old key pair, so
the browser can't follow the chain and asks them to compare the fingerprint once.

---

## Existing data (migration)

Data stored before the org set up its encryption is still plaintext. A coordinator runs
`/schluesselverwaltung/migration` (`KeyMigrationPage`):

- `GET …/migration/status` (`countPending('migration', …)`) counts rows per model that still hold
  plaintext, plus attachment contents with `contentKeyVersion = null`.
- `ReencryptJobService.run(orgId, 'migration', currentKey, …)` fetches plaintext batches,
  `migrateRow` encrypts them, and `PUT …/migration/rows` stores the ciphertext and clears the
  plaintext. The update only applies while the row still holds plaintext, so a row a member saved
  (encrypted) in the meantime isn't overwritten; members can keep working during the migration.
- Plaintext remains in backups until they expire.

`backend/prisma/pending-migrations/` holds the destructive migration that drops the plaintext
columns. It isn't in `prisma/migrations`, so `migrate deploy` never applies it by accident, and it
aborts by itself while any plaintext is left. Since encryption is optional, it only applies if
every org has activated and migrated; as long as one org runs without encryption, the plaintext
columns (and the legacy code paths) stay. See its README.

## Recovery

If every coordinator has lost their passphrase, a coordinator enrols a new key pair and uses
"Mit Wiederherstellungscode freischalten" on `/verschluesselung`: `KeySessionService.recover`
fetches `GET /keys/orgs/:orgId/recovery`, `CryptoService.openRecovery` unwraps the DEK with the
code and seals it to the coordinator's new key pair, and the result is stored as their grant
(logged as `recovery`). During a rotation the endpoint returns the recovery keys of both the
current and the pending version; `recover` grants whichever one the typed code opens. Without the code and without any coordinator's passphrase, the data
cannot be recovered; the setup page says so.

---

## What the operator can and cannot see

| The operator (database, backups, Admin role, Keycloak) | |
|---|---|
| Sees | Statistics fields (dates, durations, topics, city, postcode, counts); who is responsible for which case; user accounts; public keys, wrapped keys, grants and their log; attachment sizes and mime types. |
| Cannot see | Names, addresses, phone numbers, notes, children's data, health data, documentation text, Zielvereinbarung descriptions, handover notes, answers of personal forms, attachment contents and file names. |
| Cannot do unnoticed | Give themselves access: a grant needs a coordinator's browser, and coordinators compare fingerprints computed locally. Creating a key manager account (Admin role) doesn't help: that account still needs a grant. Re-key an active org: `setupOrg` refuses. Forge a rotation: a new version without a continuity proof made with the old key is refused (`checkKeyChain` → `keyMismatch`). Roll a user back to an older key or swap the key under the same version: the pin check refuses. Claim the org isn't encrypted: refused as well (`hasSeenEncryption`). |

### Residual risks

- **Modified frontend code.** Whoever serves the JavaScript can change it to read data while a
  user works. This is the main limit of browser-based encryption; signed desktop delivery is the
  design's phase-2 option.
- **Trust on first use.** A browser with nothing to check against trusts the first key it sees:
  a new user's first grant, or any user on a new browser. An operator could seal a key of their
  own to such a user; that user's writes would then be readable by the operator (and unreadable
  for everyone else, which would show soon). Comparing the org key fingerprint on
  `/verschluesselung` with a coordinator once, at first unlock, closes this.
- **Weak passphrases.** The wrapped private key is on the server, so it can be attacked offline.
  Argon2id and the strength meter make that expensive, not impossible.
- **Metadata** stays visible by design (statistics fields).
- **Pins are per browser.** See trust on first use. With older grants on the server the chain
  check still applies in a new browser, as long as the operator doesn't delete them.
- **OrgControllers hold the key.** As key managers they can decrypt everything in their org,
  including data the application only shows them aggregated. Accepted: the encryption protects
  the data from the operator, not between roles inside the organisation.
- **Coordinators rewrite data in bulk.** Migration and rotation let a key manager replace any
  encrypted value in their org, beyond the per-case edit rights (`canEditCase`): the server can
  store ciphertext but not check what it says. That is inherent to running these jobs in a
  coordinator's browser; the key log shows when a rotation ran.
- **Unreadable rows are never overwritten.** If a blob can't be decrypted (shown as
  `[verschlüsselt]`), `PersonalDataService` refuses to build an update on it rather than replace
  the real data with the placeholder.

## Operational notes

- **Enable**: set `ORG_ENCRYPTION_ENABLED=true` in `.env` (passed to the backend container by
  `docker-compose.yaml`) and restart the backend. Once an organisation has activated its
  encryption, the option can't be turned off again; the backend won't start without it.
- **Install**: the frontend has new dependencies (`hpke`, `@zxcvbn-ts/*`, `pdfmake`, `jszip`):
  run `npm install` in `frontend/`. The backend no longer needs `pdfmake` or `archiver`.
- **Database**: `npx prisma migrate deploy` applies `…_org_encryption`, `…_org_key_proofs` and
  `…_pending_recovery_key` (all additive only).
- **CSP**: none is configured today. If one is added, `script-src` needs `'wasm-unsafe-eval'`
  (Argon2id runs as WebAssembly) and `worker-src 'self'` (the KDF worker).
- **KDF parameters**: 64 MiB / 5 iterations by default (`newKdfParams`). The server refuses to
  store a key pair wrapped under less than the OWASP minimum of 19 MiB / 2 iterations
  (`KdfParamsSchema`). Aim for 0.5–1 s on the slowest client machine. Changed defaults apply to
  new key pairs and passphrase changes.
- **Request size**: `express.json` accepts 10 MB so rotation batches fit.
