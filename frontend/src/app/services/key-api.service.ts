import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import type {
  GrantRequest,
  KeyStatus,
  MigrationStatus,
  OrgKeyEventView,
  OrgKeyMember,
  OrgSetupRequest,
  PassphraseChangeRequest,
  RecoveryKeys,
  ReencryptRowsRequest,
  RotationCompleteRequest,
  RotationStartRequest,
  UserKeyRequest,
} from '../../../../shared/api';
import type { EncryptedModel } from '../../../../shared/utils/encryptedModels';
import { toQuery } from '../util/apiUtils';

/** Which bulk job a row or attachment request belongs to. */
export type ReencryptMode = 'rotation' | 'migration';

/** An attachment whose content a bulk job still has to process. */
export type JobAttachment = {
  id: string;
  caseId: string;
  mimeType: string;
  contentKeyVersion: number | null;
};

/**
 * The `/keys` API as promises: the key flows are sequential (derive, unwrap, open, upload), and
 * awaiting each step reads more clearly than chaining observables.
 */
@Injectable({ providedIn: 'root' })
export class KeyApiService {
  private http = inject(HttpClient);
  private url = environment.apiUrl + '/keys';

  /** Key state of the user's org, their wrapped key pair and their grants. */
  getStatus(): Promise<KeyStatus> {
    return firstValueFrom(this.http.get<KeyStatus>(`${this.url}/me`));
  }

  /** Uploads the user's key pair (first enrolment or, with `replace`, a new one). */
  enrol(body: UserKeyRequest): Promise<{ publicKey: string; fingerprint: string }> {
    return firstValueFrom(
      this.http.put<{ publicKey: string; fingerprint: string }>(`${this.url}/me`, body),
    );
  }

  /** Replaces the wrapped private key after a passphrase change. */
  changePassphrase(body: PassphraseChangeRequest): Promise<void> {
    return firstValueFrom(this.http.put<void>(`${this.url}/me/passphrase`, body));
  }

  /** Activates the org's encryption with the first coordinator's self-grant. */
  setupOrg(orgId: string, body: OrgSetupRequest): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.url}/orgs/${orgId}/setup`, body));
  }

  /** The org's members with their public keys and grant state. */
  getMembers(orgId: string): Promise<OrgKeyMember[]> {
    return firstValueFrom(this.http.get<OrgKeyMember[]>(`${this.url}/orgs/${orgId}/members`));
  }

  /** Stores a grant for a member. */
  grant(orgId: string, body: GrantRequest): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.url}/orgs/${orgId}/grants`, body));
  }

  /** Deletes every grant of a member. */
  revoke(orgId: string, userId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.url}/orgs/${orgId}/grants/${userId}`));
  }

  /** The org's key log, newest first. */
  getEvents(orgId: string): Promise<OrgKeyEventView[]> {
    return firstValueFrom(this.http.get<OrgKeyEventView[]>(`${this.url}/orgs/${orgId}/events`));
  }

  /** The recovery-wrapped keys of the current version and, during a rotation, the pending one. */
  getRecovery(orgId: string): Promise<RecoveryKeys> {
    return firstValueFrom(this.http.get<RecoveryKeys>(`${this.url}/orgs/${orgId}/recovery`));
  }

  /** Freezes the org. */
  freeze(orgId: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.url}/orgs/${orgId}/freeze`, {}));
  }

  /** Unfreezes the org. */
  unfreeze(orgId: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.url}/orgs/${orgId}/unfreeze`, {}));
  }

  /** Starts a rotation with the key manager's grant, the proof and the new recovery key. */
  startRotation(orgId: string, body: RotationStartRequest): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.url}/orgs/${orgId}/rotation/start`, body));
  }

  /** Completes a rotation with everyone's grants for the new key. */
  completeRotation(orgId: string, body: RotationCompleteRequest): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`${this.url}/orgs/${orgId}/rotation/complete`, body),
    );
  }

  /** How much a rotation or migration still has to do. */
  getJobStatus(orgId: string, mode: ReencryptMode): Promise<MigrationStatus> {
    return firstValueFrom(
      this.http.get<MigrationStatus>(`${this.url}/orgs/${orgId}/${mode}/status`),
    );
  }

  /** The next rows of a model a job has to process. */
  getJobRows(
    orgId: string,
    mode: ReencryptMode,
    model: EncryptedModel,
    take = 100,
  ): Promise<Record<string, any>[]> {
    return firstValueFrom(
      this.http.get<Record<string, any>[]>(
        `${this.url}/orgs/${orgId}/${mode}/rows` + toQuery({ model, take }),
      ),
    );
  }

  /** Stores a batch of re-encrypted rows. */
  putJobRows(
    orgId: string,
    mode: ReencryptMode,
    body: ReencryptRowsRequest,
  ): Promise<{ changed: number }> {
    return firstValueFrom(
      this.http.put<{ changed: number }>(`${this.url}/orgs/${orgId}/${mode}/rows`, body),
    );
  }

  /** The next attachments whose content a job has to process. */
  getJobAttachments(orgId: string, mode: ReencryptMode): Promise<JobAttachment[]> {
    return firstValueFrom(
      this.http.get<JobAttachment[]>(`${this.url}/orgs/${orgId}/${mode}/attachments`),
    );
  }

  /** The stored content of an attachment, as it is on disk. */
  async getJobAttachmentContent(
    orgId: string,
    mode: ReencryptMode,
    id: string,
  ): Promise<Uint8Array> {
    const blob = await firstValueFrom(
      this.http.get(`${this.url}/orgs/${orgId}/${mode}/attachments/${id}/content`, {
        responseType: 'blob',
      }),
    );
    return new Uint8Array(await blob.arrayBuffer());
  }

  /** Replaces an attachment's content with its encrypted form. */
  putJobAttachmentContent(
    orgId: string,
    mode: ReencryptMode,
    id: string,
    keyVersion: number,
    content: Uint8Array,
  ): Promise<void> {
    return firstValueFrom(
      this.http.put<void>(
        `${this.url}/orgs/${orgId}/${mode}/attachments/${id}/content` + toQuery({ keyVersion }),
        new Blob([content as BlobPart], { type: 'application/octet-stream' }),
        { headers: { 'Content-Type': 'application/octet-stream' } },
      ),
    );
  }
}
