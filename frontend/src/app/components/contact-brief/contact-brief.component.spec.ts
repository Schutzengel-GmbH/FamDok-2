import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';

import { ContactBrief } from './contact-brief.component';
import { ExportService } from 'src/app/services/export.service';
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
    const service = TestBed.inject(ExportService);
    spyOn(service, 'downloadContactDocumentation').and.resolveTo();

    const button = fixture.debugElement.query(By.css('button'));
    button.triggerEventHandler('click');

    expect(service.downloadContactDocumentation).toHaveBeenCalledWith(
      'case-1',
      'doc-1',
    );
  });

  it('renders the zusammenfassung text', () => {
    setup({ zusammenfassung: 'Ein Testbericht' });
    expect(fixture.nativeElement.textContent).toContain('Ein Testbericht');
  });

  describe('with a search hit', () => {
    function setupHit(hit: Record<string, unknown>) {
      const d = { ...doc, zusammenfassung: 'Termin beim Jobcenter' };
      fixture.componentRef.setInput('doc', d);
      fixture.componentRef.setInput('searchHit', {
        doc: d,
        topics: [],
        dokumentation: [],
        ...hit,
      });
      fixture.detectChanges();
    }

    it('marks the matched part of the summary', () => {
      setupHit({
        zusammenfassung: [
          { text: 'Termin beim ', match: false },
          { text: 'Jobcenter', match: true },
        ],
      });
      const marks = fixture.nativeElement.querySelectorAll('mark');
      expect(marks.length).toBe(1);
      expect(marks[0].textContent).toBe('Jobcenter');
      expect(fixture.nativeElement.textContent).toContain('Termin beim Jobcenter');
    });

    it('shows the plain summary when only other fields matched', () => {
      setupHit({
        dokumentation: [[{ text: 'Kita', match: true }]],
      });
      expect(fixture.nativeElement.textContent).toContain('Zusammenfassung:');
      expect(fixture.nativeElement.textContent).toContain('Termin beim Jobcenter');
    });

    it('lists the topic field with all selected topics', () => {
      setupHit({
        topics: [
          {
            label: 'Allgemeine Beratungsthemen',
            topics: [
              [
                { text: 'Wohn', match: true },
                { text: 'situation', match: false },
              ],
              [{ text: 'Finanzen', match: false }],
            ],
          },
        ],
      });
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Allgemeine Beratungsthemen:');
      expect(text).toContain('Wohnsituation, Finanzen');
    });

    it('shows one documentation line per excerpt', () => {
      setupHit({
        dokumentation: [
          [{ text: 'Kita', match: true }],
          [{ text: 'kita', match: true }],
        ],
      });
      const lines = [...fixture.nativeElement.querySelectorAll('li')].filter(
        (li: HTMLElement) => li.textContent!.includes('Dokumentation:'),
      );
      expect(lines.length).toBe(2);
    });
  });
});
