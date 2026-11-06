import { Injectable } from '@angular/core';
import type { ZxcvbnFactory } from '@zxcvbn-ts/core';

/** The verdict on a passphrase, as the strength meter shows it. */
export type PassphraseStrength = {
  /** zxcvbn's 0 (trivial) to 4 (very strong). */
  score: 0 | 1 | 2 | 3 | 4;
  /** Whether the passphrase meets the minimum for an encryption passphrase. */
  acceptable: boolean;
  /** A warning about the weakness found, in German, if any. */
  warning: string | null;
  /** Suggestions to make it stronger, in German. */
  suggestions: string[];
};

/** Below this, a passphrase is refused regardless of its score. */
export const MIN_PASSPHRASE_LENGTH = 12;
/** zxcvbn score a passphrase needs: 3 means "safely unguessable" for offline attacks with a slow hash. */
export const MIN_PASSPHRASE_SCORE = 3;

/**
 * Rates encryption passphrases with zxcvbn-ts and its German dictionaries. The library and the
 * dictionaries are large, so they are loaded on first use, only on the pages that set a
 * passphrase.
 */
@Injectable({ providedIn: 'root' })
export class PassphraseStrengthService {
  private zxcvbn: Promise<ZxcvbnFactory> | undefined;

  /**
   * Rates a passphrase. `userInputs` are words the passphrase must not lean on, such as the
   * user's name and email, which an attacker would try first.
   */
  async rate(passphrase: string, userInputs: string[] = []): Promise<PassphraseStrength> {
    const zxcvbn = await this.load();
    const result = zxcvbn.check(passphrase, userInputs);
    return {
      score: result.score,
      acceptable:
        passphrase.length >= MIN_PASSPHRASE_LENGTH && result.score >= MIN_PASSPHRASE_SCORE,
      warning: result.feedback.warning,
      suggestions: result.feedback.suggestions,
    };
  }

  /** Loads zxcvbn-ts with the common and German dictionaries, once. */
  private load(): Promise<ZxcvbnFactory> {
    this.zxcvbn ??= Promise.all([
      import('@zxcvbn-ts/core'),
      import('@zxcvbn-ts/language-common'),
      import('@zxcvbn-ts/language-de'),
    ]).then(
      ([core, common, de]) =>
        new core.ZxcvbnFactory({
          dictionary: { ...common.dictionary, ...de.dictionary },
          graphs: common.adjacencyGraphs,
          translations: de.translations,
        }),
    );
    return this.zxcvbn;
  }
}
