import { inject, Injectable } from '@angular/core';
import { from, Observable, of, OperatorFunction, switchMap } from 'rxjs';
import type {
  AnswerUpdate,
  CaseCreateRequest,
  ChildHealthDataRequest,
  ContactDocumentationCreateRequest,
  FamilyUpdateRequest,
  HandoverRequest,
  ZielCreateRequest,
  ZielUpdateRequest,
} from '../../../../shared/api';
import { isEnvelope } from '../../../../shared/utils/ciphertext';
import {
  ANSWER_VALUE_FIELDS,
  BLOB_FIELDS,
  BlobModel,
  ContextRow,
  ENCRYPTED_COLUMNS,
  EncryptedModel,
  attachmentContentContext,
  encryptionContext,
} from '../../../../shared/utils/encryptedModels';
import { CryptoService } from './crypto.service';
import { KeySessionService } from './key-session.service';
import { FullFamily } from '../../../../shared/types';

/** What a payload node can be: an encrypted model, or a container of them. */
export type PayloadModel = EncryptedModel | 'CaseFormResponse';

/** Shown in place of a value this tab can't decrypt (locked, no grant, tampered). */
export const UNREADABLE = '[verschlüsselt]';

/**
 * Where encrypted models sit inside the API's payloads, by relation name, so a whole response
 * (a case with its family, children, documentation, …) can be decrypted in one walk.
 */
const RELATIONS: Record<PayloadModel, Record<string, PayloadModel>> = {
  Case: {
    family: 'Family',
    contactDocumentation: 'ContactDocumentation',
    zielvereinbarungen: 'Zielvereinbarung',
    attachments: 'CaseAttachment',
    handovers: 'Handover',
    caseformResponses: 'CaseFormResponse',
  },
  Family: { children: 'Child', caregiver: 'Caregiver', case: 'Case' },
  Child: {},
  Caregiver: {},
  ContactDocumentation: { case: 'Case' },
  Zielvereinbarung: { case: 'Case' },
  Handover: {},
  CaseAttachment: {},
  CaseFormResponse: {
    case: 'Case',
    child: 'Child',
    caregiver: 'Caregiver',
    answers: 'Answer',
  },
  Answer: {},
};

type Row = Record<string, any> & { id: string };

/** Whether a payload holds any envelope, e.g. when an Admin looks at an encrypted org's case. */
function containsEnvelope(value: unknown, depth = 0): boolean {
  if (depth > 8 || value === null || typeof value !== 'object') return isEnvelope(value);
  if (Array.isArray(value)) return value.some((v) => containsEnvelope(v, depth + 1));
  return Object.values(value).some((v) => containsEnvelope(v, depth + 1));
}

/**
 * The single place where personal data is encrypted before it leaves the browser and decrypted
 * after it arrives. Services pipe their responses through {@link decrypting} and prepare their
 * requests with the `prepare…` methods; components keep working with plaintext objects.
 *
 * Before an org sets up its encryption everything passes through unchanged (legacy mode). Once
 * it has, rows from before the migration still hold plaintext; they are passed through as well,
 * and encrypted the next time they are saved.
 */
@Injectable({ providedIn: 'root' })
export class PersonalDataService {
  private session = inject(KeySessionService);
  private crypto = inject(CryptoService);
  /** Rows whose ciphertext this tab couldn't decrypt; they must never be re-encrypted. */
  private unreadable = new WeakSet<object>();

  /** Whether writes must be encrypted. */
  active(): boolean {
    return this.session.encryptionActive();
  }

  /**
   * An rxjs operator that decrypts each emitted payload of `model`. Payloads without ciphertext
   * (orgs without encryption) pass through synchronously, exactly as before.
   */
  decrypting<T>(model: PayloadModel): OperatorFunction<T, T> {
    return switchMap((value: T) =>
      this.active() || containsEnvelope(value) ? from(this.decrypt(model, value)) : of(value),
    );
  }

  /**
   * Decrypts every encrypted value in a payload of `model` (an object or an array of them),
   * following the relations in {@link RELATIONS}. Values that can't be decrypted become
   * {@link UNREADABLE}; plaintext values pass through.
   */
  async decrypt<T>(model: PayloadModel, value: T): Promise<T> {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value))
      return (await Promise.all(value.map((v) => this.decrypt(model, v)))) as T;
    if (typeof value !== 'object') return value;

    const row = { ...(value as Row) };
    await Promise.all(
      Object.entries(RELATIONS[model]).map(async ([key, relModel]) => {
        if (key in row) row[key] = await this.decrypt(relModel, row[key]);
      }),
    );
    if (model !== 'CaseFormResponse') await this.decryptOwn(model, row);
    return row as T;
  }

  /** Decrypts the encrypted columns of one row, in place. */
  private async decryptOwn(model: EncryptedModel, row: Row) {
    if (model in BLOB_FIELDS) {
      if (!isEnvelope(row['encrypted'])) return;
      const fields = await this.tryDecryptJson(model, row, 'encrypted');
      if (fields) Object.assign(row, fields);
      else {
        row['name'] = UNREADABLE;
        this.unreadable.add(row);
      }
      return;
    }
    if (model === 'Answer') {
      if (!isEnvelope(row['answerEncrypted'])) return;
      const fields = await this.tryDecryptJson(model, row, 'answerEncrypted');
      if (fields) Object.assign(row, fields);
      else {
        row['answerText'] = UNREADABLE;
        this.unreadable.add(row);
      }
      return;
    }
    for (const column of ENCRYPTED_COLUMNS[model]) {
      if (!isEnvelope(row[column])) continue;
      try {
        row[column] = await this.crypto.decryptField(
          row[column],
          this.session.keyResolver,
          encryptionContext(model, row as ContextRow, column),
        );
      } catch {
        row[column] = UNREADABLE;
        this.unreadable.add(row);
      }
    }
  }

  /**
   * Throws if `row` came from a payload this tab couldn't fully decrypt. Merging such a row into
   * a new blob would overwrite the real data with the placeholder.
   */
  private assertReadable(row: object) {
    if (this.unreadable.has(row))
      throw new Error('Diese Daten konnten nicht entschlüsselt werden und werden nicht überschrieben.');
  }

  /** Decrypts a JSON blob, `null` if this tab can't. */
  private async tryDecryptJson(
    model: EncryptedModel,
    row: Row,
    column: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      return await this.crypto.decryptJson<Record<string, unknown>>(
        row[column],
        this.session.keyResolver,
        encryptionContext(model, row as ContextRow, column),
      );
    } catch {
      return null;
    }
  }

  /**
   * Encrypts one string column. Empty values become `null`, so the server can still tell that a
   * field was left empty (warnings about unfinished documentation rely on that). Columns that
   * can't be null (`required`) get an envelope of the empty string instead.
   */
  async encryptField(
    model: EncryptedModel,
    row: ContextRow,
    column: string,
    value: string | null | undefined,
    required = false,
  ): Promise<string | null | undefined> {
    if (!this.active()) return value;
    if (value === undefined) return undefined;
    if ((value === null || value === '') && !required) return null;
    value ??= '';
    return this.crypto.encryptField(
      value,
      this.session.currentKey(),
      encryptionContext(model, row, column),
    );
  }

  /** Encrypts the personal fields of a blob model into its `encrypted` column. */
  async encryptBlob(model: BlobModel, id: string, values: Record<string, unknown>): Promise<string> {
    const fields: Record<string, unknown> = {};
    for (const f of BLOB_FIELDS[model]) fields[f] = values[f] ?? null;
    return this.crypto.encryptJson(
      fields,
      this.session.currentKey(),
      encryptionContext(model, { id }, 'encrypted'),
    );
  }

  /** A new row id; ciphertext is bound to it, so the browser picks it. */
  newId(): string {
    return crypto.randomUUID();
  }

  /** Splits plaintext personal fields off a blob model's request object. */
  private splitBlob<T extends Record<string, any>>(model: BlobModel, value: T) {
    const personal: Record<string, unknown> = {};
    const rest: Record<string, unknown> = {};
    const fields = BLOB_FIELDS[model] as readonly string[];
    for (const [k, v] of Object.entries(value)) {
      if (fields.includes(k)) personal[k] = v;
      else if (k !== 'encrypted') rest[k] = v;
    }
    return { personal, rest };
  }

  /** A child or caregiver of a request, encrypted under its (new or kept) id. */
  private async preparePerson<T extends Record<string, any>>(
    model: 'Child' | 'Caregiver',
    person: T,
  ): Promise<T> {
    const id = (person['id'] as string | undefined) ?? this.newId();
    if (!this.active()) return { ...person, id };
    const { personal, rest } = this.splitBlob(model, person);
    return { ...rest, id, encrypted: await this.encryptBlob(model, id, personal) } as unknown as T;
  }

  /**
   * A new case with its family: picks all ids, encrypts family, children and caregivers as
   * blobs and the free-text migration background, and copies city and postcode into the
   * plaintext statistics fields.
   */
  async prepareCaseCreate(req: CaseCreateRequest): Promise<CaseCreateRequest> {
    const id = this.newId();
    const familyId = this.newId();
    const { children = [], caregivers = [], ...family } = req.family;
    const prepared: CaseCreateRequest = {
      ...req,
      id,
      city: req.city ?? family.adress?.city ?? undefined,
      plz: req.plz ?? family.adress?.plz ?? undefined,
      specificMigrationBackground: await this.encryptField(
        'Case',
        { id },
        'specificMigrationBackground',
        req.specificMigrationBackground,
      ),
      family: {
        ...family,
        id: familyId,
        children: await Promise.all(children.map((c) => this.preparePerson('Child', c))),
        caregivers: await Promise.all(caregivers.map((c) => this.preparePerson('Caregiver', c))),
      },
    };
    if (!this.active()) return prepared;

    const { personal, rest } = this.splitBlob('Family', prepared.family);
    prepared.family = {
      ...(rest as CaseCreateRequest['family']),
      encrypted: await this.encryptBlob('Family', familyId, personal),
    };
    return prepared;
  }

  /**
   * A family update. The blob always holds all personal fields, so a partial update is merged
   * with the current (decrypted) family first.
   */
  async prepareFamilyUpdate(
    current: FullFamily,
    update: FamilyUpdateRequest,
  ): Promise<FamilyUpdateRequest> {
    if (this.active())
      for (const row of [current, current.case, ...current.children, ...current.caregiver])
        if (row) this.assertReadable(row);
    const caseId = current.case?.id;
    const caseFields = (update.case || update.adress) && {
      ...update.case,
      city: update.case?.city ?? update.adress?.city ?? undefined,
      plz: update.case?.plz ?? update.adress?.plz ?? undefined,
      specificMigrationBackground:
        caseId === undefined
          ? update.case?.specificMigrationBackground
          : await this.encryptField(
              'Case',
              { id: caseId },
              'specificMigrationBackground',
              update.case?.specificMigrationBackground,
            ),
    };
    const children =
      update.children &&
      (await Promise.all(update.children.map((c) => this.preparePerson('Child', c))));
    const caregivers =
      update.caregivers &&
      (await Promise.all(update.caregivers.map((c) => this.preparePerson('Caregiver', c))));

    if (!this.active()) return { ...update, case: caseFields, children, caregivers };

    const { personal, rest } = this.splitBlob('Family', update);
    const merged: Record<string, unknown> = {};
    for (const f of BLOB_FIELDS.Family) merged[f] = f in personal ? personal[f] : current[f];
    return {
      ...(rest as FamilyUpdateRequest),
      ...(caseFields ? { case: caseFields } : {}),
      ...(children ? { children } : {}),
      ...(caregivers ? { caregivers } : {}),
      encrypted: await this.encryptBlob('Family', current.id, merged),
    };
  }

  /** New health data of a child: plaintext before setup, else the child's whole blob again. */
  async prepareHealthData(
    child: Record<string, any> & { id: string },
    healthData: NonNullable<ChildHealthDataRequest['healthData']>,
  ): Promise<ChildHealthDataRequest> {
    if (!this.active()) return { healthData };
    this.assertReadable(child);
    return { encrypted: await this.encryptBlob('Child', child.id, { ...child, healthData }) };
  }

  /** A contact documentation with its two free-text fields encrypted. */
  async prepareContactDocumentation<T extends ContactDocumentationCreateRequest>(
    id: string,
    req: T,
  ): Promise<T> {
    return {
      ...req,
      zusammenfassung: await this.encryptField('ContactDocumentation', { id }, 'zusammenfassung', req.zusammenfassung),
      dokumentation: await this.encryptField('ContactDocumentation', { id }, 'dokumentation', req.dokumentation),
    };
  }

  /** A Zielvereinbarung with its description encrypted. */
  async prepareZiel<T extends ZielCreateRequest | ZielUpdateRequest>(id: string, req: T): Promise<T> {
    if (req.description === undefined) return req;
    const description = await this.encryptField('Zielvereinbarung', { id }, 'description', req.description, true);
    return { ...req, description: description! };
  }

  /** A handover with a new id and its notes encrypted. */
  async prepareHandover(req: HandoverRequest): Promise<HandoverRequest> {
    const id = this.newId();
    return { ...req, id, notes: await this.encryptField('Handover', { id }, 'notes', req.notes) };
  }

  /**
   * The answers of a form response. For forms with personal data in encrypted orgs, each answer's
   * typed values go into `answerEncrypted`, bound to response and question; empty answers stay
   * empty, so the server can still see which required questions are unanswered.
   */
  async prepareAnswers<T extends AnswerUpdate>(
    responseId: string,
    personal: boolean,
    answers: T[],
  ): Promise<T[]> {
    if (!this.active() || !personal) return answers;
    return Promise.all(
      answers.map(async (answer) => {
        const values: Record<string, unknown> = {};
        const rest: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(answer)) {
          if ((ANSWER_VALUE_FIELDS as readonly string[]).includes(k)) values[k] = v;
          else if (k !== 'answerEncrypted') rest[k] = v;
        }
        const empty = Object.values(values).every(
          (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0),
        );
        return {
          ...rest,
          answerEncrypted: empty
            ? null
            : await this.crypto.encryptJson(
                values,
                this.session.currentKey(),
                encryptionContext('Answer', { id: '', caseFormResponseId: responseId, questionId: answer.questionId }, 'answerEncrypted'),
              ),
        } as T;
      }),
    );
  }

  /**
   * An attachment upload: in encrypted orgs the content becomes an `FDK1` envelope and file name
   * and note are encrypted; the real mime type travels alongside.
   */
  async prepareAttachment(
    file: File,
    note?: string,
  ): Promise<{ id: string; content: Blob; filename: string; mimeType: string; note?: string; encrypted: boolean }> {
    const id = this.newId();
    if (!this.active())
      return { id, content: file, filename: file.name, mimeType: file.type, note, encrypted: false };
    const key = this.session.currentKey();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const content = await this.crypto.encryptBytes(bytes, key, attachmentContentContext(id));
    return {
      id,
      content: new Blob([content as BlobPart], { type: 'application/octet-stream' }),
      filename: (await this.encryptField('CaseAttachment', { id }, 'filename', file.name, true))!,
      mimeType: file.type,
      note: (await this.encryptField('CaseAttachment', { id }, 'note', note)) ?? undefined,
      encrypted: true,
    };
  }

  /** The plaintext content of a downloaded attachment. */
  async decryptAttachmentContent(
    attachment: { id: string; mimeType: string; contentKeyVersion?: number | null },
    blob: Blob,
  ): Promise<Blob> {
    if (attachment.contentKeyVersion === null || attachment.contentKeyVersion === undefined)
      return blob;
    const bytes = await this.crypto.decryptBytes(
      new Uint8Array(await blob.arrayBuffer()),
      this.session.keyResolver,
      attachmentContentContext(attachment.id),
    );
    return new Blob([bytes as BlobPart], { type: attachment.mimeType });
  }

  /**
   * Sends a request body: unchanged and right away before the org has set up its encryption,
   * otherwise after `prepare` encrypted it.
   */
  send<T, R>(
    plain: T,
    prepare: () => Promise<T>,
    send: (body: T) => Observable<R>,
  ): Observable<R> {
    if (!this.active()) return send(plain);
    return from(prepare()).pipe(switchMap(send));
  }
}
