import { Component } from '@angular/core';
import { ContactDocumentationTable } from 'src/app/components/contact-documentation-table/contact-documentation-table.component';

@Component({
  template: `<app-contact-documentation-table />`,
  standalone: true,
  imports: [ContactDocumentationTable],
})
export class AllContactData {}
