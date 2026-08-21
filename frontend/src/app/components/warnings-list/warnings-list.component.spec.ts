import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import Keycloak from 'keycloak-js';

import { WarningsListComponent } from './warnings-list.component';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { environment } from 'src/environments/environment';
import { WarningLevel, WarningType, FormType } from '../../../../../shared/consts';

describe('WarningsListComponent', () => {
  let component: WarningsListComponent;
  let fixture: ComponentFixture<WarningsListComponent>;
  let httpMock: HttpTestingController;
  let router: Router;

  function setup() {
    TestBed.configureTestingModule({
      imports: [WarningsListComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Keycloak, useValue: mockKeycloak() },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(WarningsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function flushWarnings(warnings: any[]) {
    httpMock.expectOne((r) => r.url.includes('/warnings')).flush(warnings);
  }

  afterEach(() => httpMock.verify());

  describe('refresh (ngOnInit)', () => {
    it('starts loading and populates warnings sorted by level descending, WARNING first', () => {
      setup();
      expect(component['isLoading']()).toBeTrue();

      const info = { level: WarningLevel.INFO, type: WarningType.CASE_NO_CONTACT, data: { caseId: 'c1', lastContact: null } };
      const warning = { level: WarningLevel.WARNING, type: WarningType.ZV_EXPIRED, data: { caseId: 'c2', finishBy: new Date(), zielvereinbarungsId: 'z1' } };
      flushWarnings([info, warning]);

      expect(component['isLoading']()).toBeFalse();
      expect(component['warnings']()).toEqual([warning, info] as any);
    });

    it('clears warnings and stops loading on error', () => {
      setup();

      httpMock
        .expectOne((r) => r.url.includes('/warnings'))
        .flush('boom', { status: 500, statusText: 'Server Error' });

      expect(component['warnings']()).toEqual([]);
      expect(component['isLoading']()).toBeFalse();
    });
  });

  describe('toggle', () => {
    it('starts expanded and flips on toggle', () => {
      setup();
      flushWarnings([]);
      expect(component['expanded']()).toBeTrue();

      component.toggle();
      expect(component['expanded']()).toBeFalse();

      component.toggle();
      expect(component['expanded']()).toBeTrue();
    });
  });

  describe('familyName', () => {
    it('looks up the family name from the cases input by warning caseId', () => {
      setup();
      flushWarnings([]);
      fixture.componentRef.setInput('cases', [
        { id: 'c1', family: { name: 'Muster' } },
      ]);

      const w = { data: { caseId: 'c1' } } as any;
      expect(component['familyName'](w)).toBe('Muster');
    });

    it('is undefined when no matching case is loaded', () => {
      setup();
      flushWarnings([]);
      fixture.componentRef.setInput('cases', []);

      expect(component['familyName']({ data: { caseId: 'unknown' } } as any)).toBeUndefined();
    });
  });

  describe('icon', () => {
    it('picks the warning vs info icon based on level', () => {
      setup();
      flushWarnings([]);

      expect(component['icon']({ level: WarningLevel.WARNING } as any)).toBe(
        'bi-exclamation-triangle-fill',
      );
      expect(component['icon']({ level: WarningLevel.INFO } as any)).toBe(
        'bi-info-circle-fill',
      );
    });
  });

  describe('message', () => {
    beforeEach(() => {
      setup();
      flushWarnings([]);
    });

    it('formats ZV_EXPIRED and ZV_EXPIRING_SOON with the finishBy date', () => {
      const finishBy = new Date('2026-01-01');
      expect(
        component['message']({ type: WarningType.ZV_EXPIRED, data: { finishBy } } as any),
      ).toBe(`Zielvereinbarung abgelaufen seit ${finishBy.toLocaleDateString('de-DE')}.`);
      expect(
        component['message']({
          type: WarningType.ZV_EXPIRING_SOON,
          data: { finishBy },
        } as any),
      ).toBe(`Zielvereinbarung läuft bald ab (${finishBy.toLocaleDateString('de-DE')}).`);
    });

    it('formats CASE_NO_CONTACT with or without a known last contact', () => {
      const lastContact = new Date('2026-02-02');
      expect(
        component['message']({
          type: WarningType.CASE_NO_CONTACT,
          data: { lastContact },
        } as any),
      ).toBe(`Kein Kontakt seit ${lastContact.toLocaleDateString('de-DE')}.`);
      expect(
        component['message']({
          type: WarningType.CASE_NO_CONTACT,
          data: { lastContact: null },
        } as any),
      ).toBe('Noch kein Kontakt dokumentiert.');
    });

    it('formats UNFINISHED_FORM and CLOSED_WITHOUT_DOC', () => {
      expect(
        component['message']({ type: WarningType.UNFINISHED_FORM, data: {} } as any),
      ).toBe('Dokumentation ist unvollständig.');
      const closedAt = new Date('2026-03-03');
      expect(
        component['message']({
          type: WarningType.CLOSED_WITHOUT_DOC,
          data: { closedAt },
        } as any),
      ).toBe(`Fall seit ${closedAt.toLocaleDateString('de-DE')} geschlossen, Abschlussdokumentation fehlt.`);
    });

    it('falls back to a generic message for an unknown type', () => {
      expect(component['message']({ type: 999, data: {} } as any)).toBe('Hinweis.');
    });
  });

  describe('hasAction / actionLabel', () => {
    beforeEach(() => {
      setup();
      flushWarnings([]);
    });

    it('is always true for warning types other than UNFINISHED_FORM', () => {
      expect(component['hasAction']({ type: WarningType.ZV_EXPIRED, data: {} } as any)).toBeTrue();
      expect(component['hasAction']({ type: WarningType.CASE_NO_CONTACT, data: {} } as any)).toBeTrue();
      expect(component['hasAction']({ type: WarningType.CLOSED_WITHOUT_DOC, data: {} } as any)).toBeTrue();
    });

    it('is true for UNFINISHED_FORM only when it is a contact-doc or has a caseFormId', () => {
      expect(
        component['hasAction']({
          type: WarningType.UNFINISHED_FORM,
          data: { formType: FormType.CONTACT_DOC },
        } as any),
      ).toBeTrue();
      expect(
        component['hasAction']({
          type: WarningType.UNFINISHED_FORM,
          data: { formType: FormType.CASE_FORM, caseFormId: 'form-1' },
        } as any),
      ).toBeTrue();
      expect(
        component['hasAction']({
          type: WarningType.UNFINISHED_FORM,
          data: { formType: FormType.CASE_FORM },
        } as any),
      ).toBeFalse();
    });

    it('returns the matching label per warning type, defaulting to "Öffnen"', () => {
      expect(component['actionLabel']({ type: WarningType.ZV_EXPIRED } as any)).toBe(
        'Zielvereinbarung öffnen',
      );
      expect(
        component['actionLabel']({ type: WarningType.CASE_NO_CONTACT } as any),
      ).toBe('Kontakt dokumentieren');
      expect(
        component['actionLabel']({ type: WarningType.UNFINISHED_FORM } as any),
      ).toBe('Dokumentation fertigstellen');
      expect(
        component['actionLabel']({ type: WarningType.CLOSED_WITHOUT_DOC } as any),
      ).toBe('Abschlussdokumentation öffnen');
      expect(component['actionLabel']({ type: 999 } as any)).toBe('Öffnen');
    });
  });

  describe('takeAction', () => {
    beforeEach(() => {
      setup();
      flushWarnings([]);
    });

    it('emits openZielvereinbarung for ZV_EXPIRED/ZV_EXPIRING_SOON', () => {
      let emitted: string | undefined;
      component.openZielvereinbarung.subscribe((id) => (emitted = id));

      component['takeAction']({
        type: WarningType.ZV_EXPIRED,
        data: { caseId: 'case-9' },
      } as any);

      expect(emitted).toBe('case-9');
    });

    it('navigates to contact-documentation for CASE_NO_CONTACT', () => {
      const navigateSpy = spyOn(router, 'navigate');

      component['takeAction']({
        type: WarningType.CASE_NO_CONTACT,
        data: { caseId: 'case-9' },
      } as any);

      expect(navigateSpy).toHaveBeenCalledWith(['contact-documentation', 'case-9']);
    });

    it('navigates to the contact documentation editor for an unfinished contact-doc form', () => {
      const navigateSpy = spyOn(router, 'navigate');

      component['takeAction']({
        type: WarningType.UNFINISHED_FORM,
        data: {
          formType: FormType.CONTACT_DOC,
          caseId: 'case-9',
          responseId: 'resp-1',
        },
      } as any);

      expect(navigateSpy).toHaveBeenCalledWith([
        'contact-documentation',
        'case-9',
        'resp-1',
      ]);
    });

    it('navigates to the response editor for an unfinished form with a caseFormId', () => {
      const navigateSpy = spyOn(router, 'navigate');

      component['takeAction']({
        type: WarningType.UNFINISHED_FORM,
        data: {
          formType: FormType.CASE_FORM,
          caseId: 'case-9',
          responseId: 'resp-1',
          caseFormId: 'form-1',
        },
      } as any);

      expect(navigateSpy).toHaveBeenCalledWith(['responses', 'form-1'], {
        queryParams: { id: 'resp-1', caseId: 'case-9' },
      });
    });

    it('fetches settings and navigates to the closing doc for CLOSED_WITHOUT_DOC', () => {
      const navigateSpy = spyOn(router, 'navigate');

      component['takeAction']({
        type: WarningType.CLOSED_WITHOUT_DOC,
        data: { caseId: 'case-9', closedAt: new Date() },
      } as any);

      httpMock
        .expectOne((r) => r.url.includes('/settings'))
        .flush([{ name: 'closing_doc', value: 'closing-form-1' }]);

      expect(navigateSpy).toHaveBeenCalledWith(['responses', 'closing-form-1'], {
        queryParams: { caseId: 'case-9' },
      });
    });

    it('does not navigate for CLOSED_WITHOUT_DOC when no closing doc is configured', () => {
      const navigateSpy = spyOn(router, 'navigate');

      component['takeAction']({
        type: WarningType.CLOSED_WITHOUT_DOC,
        data: { caseId: 'case-9', closedAt: new Date() },
      } as any);

      httpMock.expectOne((r) => r.url.includes('/settings')).flush([]);

      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });
});
