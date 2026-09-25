import { Component, inject, input, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ContactDocumentationService } from 'src/app/services/contact-documentation.service';
import { ContactDocumentationOptions } from '../../../../../shared/sharedGlobals';
import { FullContactDocumentation } from '../../../../../shared/types';
import { userPipe } from 'src/app/util/tableTransformPipes';

@Component({
  selector: 'app-contact-brief',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './contact-brief.component.html',
  styleUrl: './contact-brief.component.scss',
})
export class ContactBrief implements OnInit {
  documentationService = inject(ContactDocumentationService);
  doc = input.required<FullContactDocumentation>();
  hasWarning = input<boolean>(false);
  readOnly = input(false);
  link!: string;

  ngOnInit() {
    this.link = `/contact-documentation/${this.doc().caseId}/${this.doc().id}`;
  }

  userPipe = userPipe;

  artString() {
    if (this.doc().artDerBetreuung == null) return '';
    return ContactDocumentationOptions['artDerBetreuung'].at(
      this.doc().artDerBetreuung!,
    )!.text;
  }

  durationString() {
    if (this.doc().start && this.doc().end)
      return `Von ${this.doc().start?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–${this.doc().end?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Uhr`;
    else
      return this.doc().duration
        ? 'Dauer: ' + this.doc().duration + ' Minuten'
        : '';
  }
}
