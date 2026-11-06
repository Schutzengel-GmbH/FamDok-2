import { Component, computed, effect, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MIN_PASSPHRASE_LENGTH,
  PassphraseStrength,
  PassphraseStrengthService,
} from 'src/app/services/passphrase-strength.service';

const LABELS = ['Sehr schwach', 'Schwach', 'Mittel', 'Stark', 'Sehr stark'];
const COLORS = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-success', 'bg-success'];

/**
 * Entry of a new encryption passphrase: the passphrase, its repetition and a strength meter.
 * `valid` turns true only for a strong enough passphrase entered identically twice.
 */
@Component({
  selector: 'app-passphrase-input',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="mb-2">
      <label class="form-label" [for]="idPrefix() + '-pass'">{{ label() }}</label>
      <input
        [id]="idPrefix() + '-pass'"
        type="password"
        class="form-control"
        autocomplete="new-password"
        [ngModel]="passphrase()"
        (ngModelChange)="passphrase.set($event)" />
      <div class="progress mt-2" style="height: 6px" aria-hidden="true">
        <div
          class="progress-bar"
          [class]="barColor()"
          [style.width.%]="((strength()?.score ?? 0) + 1) * 20"></div>
      </div>
      @if (passphrase()) {
        <div class="form-text">
          {{ scoreLabel() }}
          @if (passphrase().length < minLength) {
            – mindestens {{ minLength }} Zeichen
          }
          @if (strength()?.warning) {
            <br />{{ strength()!.warning }}
          }
          @for (s of strength()?.suggestions ?? []; track s) {
            <br />{{ s }}
          }
        </div>
      }
    </div>
    <div class="mb-2">
      <label class="form-label" [for]="idPrefix() + '-repeat'">Passphrase wiederholen</label>
      <input
        [id]="idPrefix() + '-repeat'"
        type="password"
        class="form-control"
        autocomplete="new-password"
        [class.is-invalid]="repeat() && repeat() !== passphrase()"
        [ngModel]="repeat()"
        (ngModelChange)="repeat.set($event)" />
      <div class="invalid-feedback">Die Eingaben stimmen nicht überein.</div>
    </div>
  `,
})
export class PassphraseInputComponent {
  private strengthService = inject(PassphraseStrengthService);

  /** Label of the first field. */
  label = input('Neue Verschlüsselungs-Passphrase');
  /** Prefix for the input ids, so two instances on a page don't collide. */
  idPrefix = input('passphrase');
  /** Words the passphrase must not be built from (name, email). */
  userInputs = input<string[]>([]);

  /** The entered passphrase. */
  passphrase = model('');
  /** Whether the passphrase is strong enough and repeated correctly. */
  valid = model(false);

  protected repeat = signal('');
  protected strength = signal<PassphraseStrength | null>(null);
  protected readonly minLength = MIN_PASSPHRASE_LENGTH;
  protected scoreLabel = computed(() => LABELS[this.strength()?.score ?? 0]);
  protected barColor = computed(() => 'progress-bar ' + COLORS[this.strength()?.score ?? 0]);

  constructor() {
    effect(() => {
      const value = this.passphrase();
      const inputs = this.userInputs();
      if (!value) {
        this.strength.set(null);
        return;
      }
      this.strengthService.rate(value, inputs).then((s) => {
        if (this.passphrase() === value) this.strength.set(s);
      });
    });
    effect(() => {
      this.valid.set(
        !!this.strength()?.acceptable && this.repeat() === this.passphrase(),
      );
    });
  }
}
