import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { MigrationStatus } from '../../../../../shared/api';
import { KeyApiService } from 'src/app/services/key-api.service';
import { KeySessionService } from 'src/app/services/key-session.service';
import { JobProgress, ReencryptJobService } from 'src/app/services/reencrypt-job.service';

/** German labels of the encrypted models, for the status table. */
export const MODEL_LABELS: Record<string, string> = {
  Family: 'Familien',
  Child: 'Kinder',
  Caregiver: 'Bezugspersonen',
  Case: 'Fälle (Migrationshintergrund)',
  ContactDocumentation: 'Kontaktdokumentationen',
  Zielvereinbarung: 'Zielvereinbarungen',
  Handover: 'Übergaben',
  CaseAttachment: 'Anhänge (Name, Notiz)',
  Answer: 'Antworten personenbezogener Fragebögen',
};

/**
 * Encrypting an org's existing data (P5): after the encryption is set up, rows from before still
 * hold plaintext. A coordinator's browser reads them, encrypts them and uploads the ciphertext;
 * the server then clears the plaintext. Members can keep working meanwhile, since every row they
 * save is encrypted anyway, and the job skips rows changed in between.
 */
@Component({
  selector: 'app-key-migration-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './key-migration.page.html',
})
export class KeyMigrationPage {
  protected session = inject(KeySessionService);
  private api = inject(KeyApiService);
  private job = inject(ReencryptJobService);

  protected status = signal<MigrationStatus | null>(null);
  protected progress = signal<JobProgress | null>(null);
  protected running = signal(false);
  protected error = signal<string | null>(null);

  /** German label of a model. */
  protected label(model: string): string {
    return MODEL_LABELS[model] ?? model;
  }

  protected rows = computed(() =>
    Object.entries(this.status()?.rows ?? {}).map(([model, count]) => ({ model, count })),
  );
  protected remaining = computed(() => {
    const s = this.status();
    return s ? Object.values(s.rows).reduce((a, b) => a + b, 0) + s.attachmentContents : 0;
  });

  constructor() {
    this.load();
  }

  /** Fetches how much plaintext is left. */
  protected async load() {
    await this.session.ensureLoaded();
    if (!this.session.isUnlocked()) return;
    this.status.set(await this.api.getJobStatus(this.session.requireOrgId(), 'migration'));
  }

  /** Encrypts everything that is left. Can be run again after an interruption. */
  protected async start() {
    this.running.set(true);
    this.error.set(null);
    try {
      await this.job.run(
        this.session.requireOrgId(),
        'migration',
        this.session.currentKey(),
        this.session.keyResolver,
        (p) => this.progress.set(p),
      );
    } catch (e) {
      this.error.set(
        'Die Verschlüsselung wurde unterbrochen. Starten Sie sie erneut; bereits verschlüsselte Daten werden übersprungen.',
      );
      console.error(e);
    } finally {
      this.running.set(false);
      await this.load();
    }
  }
}
