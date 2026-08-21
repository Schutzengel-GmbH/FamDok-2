import { Component, inject, input, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ContactDocumentationService } from 'src/app/services/contact-documentation.service';
import { FullContactDocumentation } from '../../../../../shared/types';
import { ContactDocumentationModel as ContactDocumentation } from '../../../../../shared/generated/prisma/models';

@Component({
  selector: 'app-contact-brief',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './contact-brief.component.html',
})
export class ContactBrief implements OnInit {
  documentationService = inject(ContactDocumentationService);
  doc = input.required<ContactDocumentation>();
  hasWarning = input<boolean>(false);
  readOnly = input(false);
  link!: string;

  ngOnInit() {
    this.link = `/contact-documentation/${this.doc().caseId}/${this.doc().id}`;
  }
}
