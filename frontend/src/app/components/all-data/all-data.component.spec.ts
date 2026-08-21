import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import Keycloak from 'keycloak-js';

import { AllDataComponent } from './all-data.component';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { buildUser, buildQuestion, buildAnswer } from 'src/app/testing/fixtures';
import { environment } from 'src/environments/environment';
import { Role, QuestionType } from '../../../../../shared/generated/prisma/enums';

describe('AllDataComponent', () => {
  let component: AllDataComponent;
  let fixture: ComponentFixture<AllDataComponent>;
  let httpMock: HttpTestingController;
  let router: Router;

  const question = buildQuestion({
    id: 'q-text',
    type: QuestionType.Text,
    text: 'Notiz',
  });
  const form = { id: 'form-1', name: 'Aufnahme', questions: [question] } as any;

  function setup(user = buildUser({ role: Role.User, id: 'me' })) {
    TestBed.configureTestingModule({
      imports: [AllDataComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Keycloak, useValue: mockKeycloak() },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(AllDataComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('form', form);
    fixture.detectChanges();
    httpMock.expectOne(`${environment.apiUrl}/me`).flush(user);
    httpMock.expectOne(`${environment.apiUrl}/org`).flush([]);
    return user;
  }

  function currentRequestUrl() {
    const req = httpMock.expectOne((r) => r.url.includes('/case-form-response'));
    return { req, url: decodeURIComponent(req.request.url) };
  }

  afterEach(() => httpMock.verify());

  it('scopes responses to only the cases the current user is responsible for, for a plain User', () => {
    setup(buildUser({ role: Role.User, id: 'me' }));

    const { req, url } = currentRequestUrl();
    expect(url).toContain('"responsibleUsers":{"some":{"id":"me"}}');
    req.flush([]);
  });

  it("scopes responses to the current user's organisation for an OrgController/OrgCoordinator", () => {
    setup(
      buildUser({ role: Role.OrgCoordinator, id: 'me', organisationId: 'org-9' }),
    );

    const { req, url } = currentRequestUrl();
    expect(url).toContain('"organisation":{"id":"org-9"}');
    req.flush([]);
  });

  it('scopes responses to the sub-organisations for a SubOrgCoordinator', () => {
    setup(
      buildUser({
        role: Role.SubOrgCoordinator,
        id: 'me',
        subOrganisations: [{ id: 'sub-1' }, { id: 'sub-2' }],
      }),
    );

    const { req, url } = currentRequestUrl();
    expect(url).toContain('"subOrganisationId":{"in":["sub-1","sub-2"]}');
    req.flush([]);
  });

  it('leaves the case filter untouched for Admin/Controller', () => {
    setup(buildUser({ role: Role.Admin, id: 'me' }));

    const { req, url } = currentRequestUrl();
    expect(url).not.toContain('"case":');
    req.flush([]);
  });

  describe('canEditRow', () => {
    it('is false before the current user has loaded', () => {
      TestBed.configureTestingModule({
        imports: [AllDataComponent],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: Keycloak, useValue: mockKeycloak() },
        ],
      });
      httpMock = TestBed.inject(HttpTestingController);
      fixture = TestBed.createComponent(AllDataComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('form', form);
      fixture.detectChanges();

      const row = { case: { responsibleUsers: [] } } as any;
      expect(component.canEditRow(row)).toBeFalse();

      // Flush the outstanding requests so httpMock.verify() in afterEach is satisfied.
      httpMock.expectOne(`${environment.apiUrl}/me`).flush(buildUser({ role: Role.User }));
      httpMock.expectOne(`${environment.apiUrl}/org`).flush([]);
      httpMock.expectOne((r) => r.url.includes('/case-form-response')).flush([]);
    });

    it('is always true for an Admin', () => {
      setup(buildUser({ role: Role.Admin, id: 'admin-1' }));
      httpMock.expectOne((r) => r.url.includes('/case-form-response')).flush([]);

      const row = { case: { responsibleUsers: [{ id: 'someone-else' }] } } as any;
      expect(component.canEditRow(row)).toBeTrue();
    });

    it('is true only when the user is one of the case responsibleUsers otherwise', () => {
      setup(buildUser({ role: Role.User, id: 'me' }));
      httpMock.expectOne((r) => r.url.includes('/case-form-response')).flush([]);

      const ownRow = { case: { responsibleUsers: [{ id: 'me' }] } } as any;
      const otherRow = { case: { responsibleUsers: [{ id: 'other' }] } } as any;
      expect(component.canEditRow(ownRow)).toBeTrue();
      expect(component.canEditRow(otherRow)).toBeFalse();
    });
  });

  describe('navigation', () => {
    it('edit navigates to the response editor', () => {
      setup();
      httpMock.expectOne((r) => r.url.includes('/case-form-response')).flush([]);
      const navigateSpy = spyOn(router, 'navigate');

      component.edit('resp-1');

      expect(navigateSpy).toHaveBeenCalledWith(['responses', 'form-1'], {
        queryParams: { id: 'resp-1' },
      });
    });

    it('inspect navigates to the response editor in readonly mode', () => {
      setup();
      httpMock.expectOne((r) => r.url.includes('/case-form-response')).flush([]);
      const navigateSpy = spyOn(router, 'navigate');

      component.inspect('resp-1');

      expect(navigateSpy).toHaveBeenCalledWith(['responses', 'form-1'], {
        queryParams: { id: 'resp-1', readonly: true },
      });
    });
  });

  describe('filters', () => {
    it('caseFilterChange sets the case portion of the filter', () => {
      setup();
      httpMock.expectOne((r) => r.url.includes('/case-form-response')).flush([]);

      component.caseFilterChange({ city: { contains: 'Berlin' } } as any);

      expect(component.filter().case).toEqual({
        city: { contains: 'Berlin' },
      } as any);
    });

    it('questionFilterChange AND-combines independent per-question filters', () => {
      setup();
      httpMock.expectOne((r) => r.url.includes('/case-form-response')).flush([]);

      component.questionFilterChange('q1', { answerText: { contains: 'a' } });
      component.questionFilterChange('q2', { answerInt: { gte: 5 } });

      expect(component.filter().AND).toEqual([
        { answers: { some: { answerText: { contains: 'a' } } } },
        { answers: { some: { answerInt: { gte: 5 } } } },
      ] as any);
    });

    it('questionFilterChange replaces an existing filter for the same question rather than duplicating it', () => {
      setup();
      httpMock.expectOne((r) => r.url.includes('/case-form-response')).flush([]);

      component.questionFilterChange('q1', { answerText: { contains: 'a' } });
      component.questionFilterChange('q1', { answerText: { contains: 'b' } });

      expect(component.filter().AND).toEqual([
        { answers: { some: { answerText: { contains: 'b' } } } },
      ] as any);
    });
  });

  describe('getValue', () => {
    function rowWithAnswer(answer: any) {
      return { answers: [answer] } as any;
    }

    it("returns '---' when there is no matching answer", () => {
      setup();
      httpMock.expectOne((r) => r.url.includes('/case-form-response')).flush([]);

      const q = buildQuestion({ id: 'missing', type: QuestionType.Text });
      expect(component.getValue({ answers: [] } as any, q)).toBe('---');
    });

    it('returns answerInt for Integer questions', () => {
      setup();
      httpMock.expectOne((r) => r.url.includes('/case-form-response')).flush([]);

      const q = buildQuestion({ id: 'q1', type: QuestionType.Integer });
      const row = rowWithAnswer(buildAnswer({ questionId: 'q1', answerInt: 42 }));
      expect(component.getValue(row, q)).toBe(42);
    });

    it('returns answerNum for Float questions', () => {
      setup();
      httpMock.expectOne((r) => r.url.includes('/case-form-response')).flush([]);

      const q = buildQuestion({ id: 'q1', type: QuestionType.Float });
      const row = rowWithAnswer(buildAnswer({ questionId: 'q1', answerNum: 3.5 }));
      expect(component.getValue(row, q)).toBe(3.5);
    });

    it('returns answerText for Text and Textarea questions', () => {
      setup();
      httpMock.expectOne((r) => r.url.includes('/case-form-response')).flush([]);

      const qText = buildQuestion({ id: 'q1', type: QuestionType.Text });
      const qArea = buildQuestion({ id: 'q1', type: QuestionType.Textarea });
      const row = rowWithAnswer(
        buildAnswer({ questionId: 'q1', answerText: 'hallo' }),
      );
      expect(component.getValue(row, qText)).toBe('hallo');
      expect(component.getValue(row, qArea)).toBe('hallo');
    });

    it('formats answerDate as a localized date string for Date questions, or empty when unset', () => {
      setup();
      httpMock.expectOne((r) => r.url.includes('/case-form-response')).flush([]);

      const q = buildQuestion({ id: 'q1', type: QuestionType.Date });
      const date = new Date('2026-03-05');
      const withDate = rowWithAnswer(
        buildAnswer({ questionId: 'q1', answerDate: date }),
      );
      const withoutDate = rowWithAnswer(
        buildAnswer({ questionId: 'q1', answerDate: null }),
      );
      expect(component.getValue(withDate, q)).toBe(date.toLocaleDateString());
      expect(component.getValue(withoutDate, q)).toBe('');
    });

    it('joins the text of selected (non-open) Select options', () => {
      setup();
      httpMock.expectOne((r) => r.url.includes('/case-form-response')).flush([]);

      const q = buildQuestion({
        id: 'q1',
        type: QuestionType.Select,
        selectOptions: [
          { id: 'opt-1', text: 'Rot', isOpen: false },
          { id: 'opt-2', text: 'Blau', isOpen: false },
        ],
      });
      const row = rowWithAnswer(
        buildAnswer({ questionId: 'q1', answerSelectId: ['opt-1', 'opt-2'] }),
      );
      expect(component.getValue(row, q)).toBe('Rot,Blau');
    });

    it('falls back to the free-text answer for an open Select option', () => {
      setup();
      httpMock.expectOne((r) => r.url.includes('/case-form-response')).flush([]);

      const q = buildQuestion({
        id: 'q1',
        type: QuestionType.Select,
        selectOptions: [{ id: 'opt-1', text: 'Sonstiges', isOpen: true }],
      });
      const row = rowWithAnswer(
        buildAnswer({
          questionId: 'q1',
          answerSelectId: ['opt-1'],
          answerText: 'Eigene Angabe',
        }),
      );
      expect(component.getValue(row, q)).toBe('Eigene Angabe');
    });
  });

  describe('exportCsv', () => {
    it('builds a CSV with a column per question plus Fall/Erstellt von, and triggers a download', async () => {
      setup(buildUser({ role: Role.Admin, id: 'admin-1' }));

      const row = {
        case: { city: 'Berlin', startedAt: new Date('2026-01-10') },
        answers: [buildAnswer({ questionId: 'q-text', answerText: 'Hallo Welt' })],
        createdBy: buildUser({ firstName: 'Anna', lastName: 'Muster', id: 'u1' }),
      };
      httpMock.expectOne((r) => r.url.includes('/case-form-response')).flush([row]);

      let capturedBlob: Blob | undefined;
      spyOn(URL, 'createObjectURL').and.callFake((blob: any) => {
        capturedBlob = blob;
        return 'blob:mock';
      });
      spyOn(URL, 'revokeObjectURL');
      const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');

      component['exportCsv']();

      expect(clickSpy).toHaveBeenCalled();
      const text = await capturedBlob!.text();
      const lines = text.replace(/^﻿/, '').split('\r\n');
      expect(lines[0]).toBe('Fall;Notiz;Erstellt von');
      expect(lines[1]).toContain('Hallo Welt');
      expect(lines[1]).toContain('Anna Muster');
    });
  });

  describe('exportJson', () => {
    it('exports the raw response rows as JSON and triggers a download', async () => {
      setup(buildUser({ role: Role.Admin, id: 'admin-1' }));

      const row = {
        case: { city: 'Berlin', startedAt: new Date('2026-01-10') },
        answers: [buildAnswer({ questionId: 'q-text', answerText: 'Hallo Welt' })],
        createdBy: buildUser({ firstName: 'Anna', lastName: 'Muster', id: 'u1' }),
      };
      httpMock.expectOne((r) => r.url.includes('/case-form-response')).flush([row]);

      let capturedBlob: Blob | undefined;
      spyOn(URL, 'createObjectURL').and.callFake((blob: any) => {
        capturedBlob = blob;
        return 'blob:mock';
      });
      spyOn(URL, 'revokeObjectURL');
      const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');

      component['exportJson']();

      expect(clickSpy).toHaveBeenCalled();
      expect(capturedBlob!.type).toContain('application/json');
      const parsed = JSON.parse(await capturedBlob!.text());
      expect(parsed).toEqual([
        jasmine.objectContaining({
          answers: jasmine.arrayContaining([
            jasmine.objectContaining({ answerText: 'Hallo Welt' }),
          ]),
        }),
      ]);
    });
  });

  describe('exportXlsx', () => {
    it('builds an xlsx workbook with a column per question plus Fall/Erstellt von, and triggers a download', async () => {
      setup(buildUser({ role: Role.Admin, id: 'admin-1' }));

      const row = {
        case: { city: 'Berlin', startedAt: new Date('2026-01-10') },
        answers: [buildAnswer({ questionId: 'q-text', answerText: 'Hallo Welt' })],
        createdBy: buildUser({ firstName: 'Anna', lastName: 'Muster', id: 'u1' }),
      };
      httpMock.expectOne((r) => r.url.includes('/case-form-response')).flush([row]);

      let capturedBlob: Blob | undefined;
      spyOn(URL, 'createObjectURL').and.callFake((blob: any) => {
        capturedBlob = blob;
        return 'blob:mock';
      });
      spyOn(URL, 'revokeObjectURL');
      const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');

      await component['exportXlsx']();

      expect(clickSpy).toHaveBeenCalled();
      expect(capturedBlob!.size).toBeGreaterThan(0);
      expect(capturedBlob!.type).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    });
  });
});
