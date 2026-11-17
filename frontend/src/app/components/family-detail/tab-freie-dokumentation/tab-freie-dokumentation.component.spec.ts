import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';

import { TabFreieDokumentationComponent } from './tab-freie-dokumentation.component';
import { WarningType, FormType } from '../../../../../../shared/consts';

describe('TabFreieDokumentationComponent', () => {
  let component: TabFreieDokumentationComponent;
  let fixture: ComponentFixture<TabFreieDokumentationComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabFreieDokumentationComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TabFreieDokumentationComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('selectedCase', { id: 'case-1' } as any);
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url.includes('/warnings')).flush([]);
    httpMock.expectOne((r) => r.url.includes('/documentation/latest')).flush([]);
  });

  afterEach(() => httpMock.verify());

  it('addContact navigates to the contact documentation editor', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    component.addContact();

    expect(router.navigate).toHaveBeenCalledWith(['contact-documentation', 'case-1']);
  });

  it('addContact is a no-op when readOnly', () => {
    fixture.componentRef.setInput('readOnly', true);
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    component.addContact();

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('hasWarning is false with no matching warnings', () => {
    expect(component.hasWarning('doc-1')).toBeFalse();
  });

  describe('keyword search', () => {
    function type(value: string) {
      const input: HTMLInputElement = fixture.nativeElement.querySelector(
        'input[type=search]',
      );
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      return input;
    }

    function submitButton(): HTMLButtonElement {
      return fixture.nativeElement.querySelector('form button[type=submit]');
    }

    beforeEach(() => {
      component.mode.set('filter');
      fixture.detectChanges();
    });

    it('shows the search form instead of the latest contacts', () => {
      expect(fixture.nativeElement.querySelector('form[role=search]')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('h6.section-title').textContent.trim()).toBe(
        'Kontakte filtern',
      );
    });

    it('needs at least four characters before searching', () => {
      type('Kit');
      expect(submitButton().disabled).toBeTrue();
      component.search();
      httpMock.expectNone((r) => /\/i\/case-1\/documentation(\?|$)/.test(r.url));

      type('  Kit  ');
      expect(submitButton().disabled).toBeTrue();

      type('Kita');
      expect(submitButton().disabled).toBeFalse();
    });

    it('does not search while typing', () => {
      type('Kitaplatz');
      httpMock.expectNone((r) => /\/i\/case-1\/documentation(\?|$)/.test(r.url));
    });

    it('loads the contacts of the case on submit and shows the hits', () => {
      type('kita');
      fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));

      httpMock
        .expectOne((r) => /\/i\/case-1\/documentation(\?|$)/.test(r.url))
        .flush([
          {
            id: 'doc-1',
            caseId: 'case-1',
            date: '2026-01-15T00:00:00.000Z',
            beratungsThemenEltern: [],
            beratungsThemenKinder: [],
            beratungsThemenAllgemein: [],
            zusammenfassung: 'Gespräch über den Kitaplatz',
            dokumentation: null,
          },
          {
            id: 'doc-2',
            caseId: 'case-1',
            date: '2026-01-10T00:00:00.000Z',
            beratungsThemenEltern: [],
            beratungsThemenKinder: [],
            beratungsThemenAllgemein: [],
            zusammenfassung: 'Telefonat',
            dokumentation: null,
          },
        ]);
      fixture.detectChanges();

      expect(component.searchedTerm()).toBe('kita');
      expect(component.searchResults().map((h) => h.doc.id)).toEqual(['doc-1']);
      expect(fixture.nativeElement.querySelector('mark')?.textContent).toBe('Kita');
    });

    it('tells the user when nothing was found', () => {
      type('Schule');
      component.search();
      httpMock
        .expectOne((r) => /\/i\/case-1\/documentation(\?|$)/.test(r.url))
        .flush([]);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Keine Kontakte mit „Schule“ gefunden.');
    });
  });
});

describe('TabFreieDokumentationComponent with an unfinished contact doc warning', () => {
  let component: TabFreieDokumentationComponent;
  let fixture: ComponentFixture<TabFreieDokumentationComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabFreieDokumentationComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TabFreieDokumentationComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('selectedCase', { id: 'case-1' } as any);
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url.includes('/warnings')).flush([
      {
        type: WarningType.UNFINISHED_FORM,
        data: { caseId: 'case-1', formType: FormType.CONTACT_DOC, responseId: 'doc-1' },
      },
    ]);
    httpMock.expectOne((r) => r.url.includes('/documentation/latest')).flush([]);
  });

  afterEach(() => httpMock.verify());

  it('hasWarning is true for the flagged doc', () => {
    expect(component.hasWarning('doc-1')).toBeTrue();
    expect(component.hasWarning('doc-2')).toBeFalse();
  });
});
