import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';

import { ContactBrief } from './contact-brief.component';
import { ContactDocumentationService } from 'src/app/services/contact-documentation.service';

describe('ContactBrief', () => {
  let component: ContactBrief;
  let fixture: ComponentFixture<ContactBrief>;
  let httpMock: HttpTestingController;

  const doc = {
    id: 'doc-1',
    caseId: 'case-1',
    date: new Date('2024-01-15'),
    zusammenfassung: 'Alles gut gelaufen',
  } as any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactBrief],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ContactBrief);
    component = fixture.componentInstance;
  });

  afterEach(() => httpMock.verify());

  function setup(
    overrides: Partial<typeof doc> = {},
    inputs: { hasWarning?: boolean; readOnly?: boolean } = {},
  ) {
    fixture.componentRef.setInput('doc', { ...doc, ...overrides });
    if (inputs.hasWarning !== undefined) {
      fixture.componentRef.setInput('hasWarning', inputs.hasWarning);
    }
    if (inputs.readOnly !== undefined) {
      fixture.componentRef.setInput('readOnly', inputs.readOnly);
    }
    fixture.detectChanges();
  }

  it('builds the detail link from the doc caseId and id', () => {
    setup();
    expect(component.link).toBe('/contact-documentation/case-1/doc-1');
  });

  it('shows the warning badge only when hasWarning is true', () => {
    setup({}, { hasWarning: true });
    expect(fixture.nativeElement.querySelector('.badge')).toBeTruthy();
  });

  it('hides the warning badge by default', () => {
    setup();
    expect(fixture.nativeElement.querySelector('.badge')).toBeFalsy();
  });

  it('shows an edit affordance and no readonly query param when not read-only', () => {
    setup();
    const link = fixture.debugElement.query(By.css('a'));
    const icon = link.query(By.css('i'));
    expect(link.attributes['aria-label']).toBe('Bearbeiten');
    expect(icon.nativeElement.classList.contains('bi-pencil')).toBeTrue();
    expect(icon.nativeElement.classList.contains('bi-eye')).toBeFalse();
  });

  it('shows a view affordance when read-only', () => {
    setup({}, { readOnly: true });
    const link = fixture.debugElement.query(By.css('a'));
    const icon = link.query(By.css('i'));
    expect(link.attributes['aria-label']).toBe('Ansehen');
    expect(icon.nativeElement.classList.contains('bi-eye')).toBeTrue();
    expect(icon.nativeElement.classList.contains('bi-pencil')).toBeFalse();
  });

  it('triggers a PDF download with the case and doc ids on click', () => {
    setup();
    const service = TestBed.inject(ContactDocumentationService);
    spyOn(service, 'downloadContactDocumentationPDF');

    const button = fixture.debugElement.query(By.css('button'));
    button.triggerEventHandler('click');

    expect(service.downloadContactDocumentationPDF).toHaveBeenCalledWith(
      'case-1',
      'doc-1',
    );
  });

  it('renders the zusammenfassung text', () => {
    setup({ zusammenfassung: 'Ein Testbericht' });
    expect(fixture.nativeElement.textContent).toContain('Ein Testbericht');
  });
});
