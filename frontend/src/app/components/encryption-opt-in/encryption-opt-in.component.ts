import { Component } from '@angular/core';

/**
 * Explains that the org encryption is an opt-in setting and what activating it means, above all
 * that it can't be switched off again. Shown to key managers wherever they can activate it.
 */
@Component({
  selector: 'app-encryption-opt-in',
  standalone: true,
  template: `
    <div class="alert alert-info">
      <p>
        <strong>Die Verschlüsselung ist optional.</strong> Sie wird für jede
        Organisation einzeln aktiviert. Solange sie nicht aktiviert ist, werden
        personenbezogene Daten wie bisher unverschlüsselt auf dem Server
        gespeichert.
      </p>
      <p class="mb-1">Nach der Aktivierung</p>
      <ul>
        <li>
          werden personenbezogene Daten nur noch im Browser ver- und
          entschlüsselt; der Betreiber kann sie nicht mehr lesen,
        </li>
        <li>
          braucht jedes Mitglied eine eigene Verschlüsselungs-Passphrase und muss
          von der Schlüsselverwaltung nach einem Fingerabdruck-Vergleich
          freigeschaltet werden,
        </li>
        <li>
          sind die Daten verloren, wenn alle Passphrasen der
          Schlüsselverwaltung und der Wiederherstellungscode verloren gehen.
        </li>
      </ul>
      <p class="mb-0">
        <strong>Die Aktivierung lässt sich nicht rückgängig machen.</strong> Es
        gibt keine Funktion, die Verschlüsselung wieder abzuschalten.
      </p>
    </div>
  `,
})
export class EncryptionOptInComponent {}
