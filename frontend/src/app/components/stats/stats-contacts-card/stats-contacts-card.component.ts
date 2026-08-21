import { Component, input } from '@angular/core';
import { AnonContactDocumentation } from '../../../../../../shared/types';
import {
  BETREUUNG_ID,
  ContactDocumentationOptions,
} from '../../../../../../shared/sharedGlobals';

@Component({
  selector: 'app-contact-card',
  templateUrl: './stats-contacts-card.component.html',
  styleUrls: [
    '../stats-card-styles.scss',
    './stats-contacts-card.component.scss',
  ],
  standalone: true,
})
export class StatsContactCard {
  docs = input.required<AnonContactDocumentation[]>();

  artOptions = ContactDocumentationOptions['artDerBetreuung'];

  countBy(id: BETREUUNG_ID) {
    return this.docs().reduce(
      (n, doc) => (doc.artDerBetreuung === id ? n + 1 : n),
      0,
    );
  }
}
