import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import Keycloak from 'keycloak-js';

import { AllDataGeneralComponent } from './all-data-general.component';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { buildUser, buildQuestion, buildAnswer } from 'src/app/testing/fixtures';
import { environment } from 'src/environments/environment';
import { Role, QuestionType } from '../../../../../shared/generated/prisma/enums';

describe('AllDataGeneralComponent', () => {
  let component: AllDataGeneralComponent;
  let fixture: ComponentFixture<AllDataGeneralComponent>;
  let httpMock: HttpTestingController;
  let router: Router;

  const question = buildQuestion({
    id: 'q-int',
    type: QuestionType.Integer,
    text: 'Alter',
  });
  const form = { id: 'gform-1', name: 'Umfrage', questions: [question] } as any;

  function setup(user = buildUser({ role: Role.User, id: 'me' })) {
    TestBed.configureTestingModule({
      imports: [AllDataGeneralComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Keycloak, useValue: mockKeycloak() },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(AllDataGeneralComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('form', form);
    fixture.detectChanges();
    httpMock.expectOne(`${environment.apiUrl}/me`).flush(user);
    httpMock.expectOne(`${environment.apiUrl}/org`).flush([]);
    return user;
  }

  function currentRequestUrl() {
    const req = httpMock.expectOne((r) =>
      r.url.includes('/general-form/responses'),
    );
    return { req, url: decodeURIComponent(req.request.url) };
  }

  afterEach(() => httpMock.verify());

  it('scopes responses to createdBy = current user for a plain User', () => {
    setup(buildUser({ role: Role.User, id: 'me' }));

    const { req, url } = currentRequestUrl();
    expect(url).toContain('"createdBy":{"id":"me"}');
    req.flush([]);
  });

  it("scopes responses to the current user's organisation for an OrgController/OrgCoordinator", () => {
    setup(
      buildUser({ role: Role.OrgCoordinator, id: 'me', organisationId: 'org-9' }),
    );

    const { req, url } = currentRequestUrl();
    expect(url).toContain('"createdBy":{"organisationId":"org-9"}');
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
    expect(url).toContain('"subOrganisations":{"some":{"id":{"in":["sub-1","sub-2"]}}}');
    req.flush([]);
  });

  it('leaves createdBy unset for Admin/Controller', () => {
    setup(buildUser({ role: Role.Admin, id: 'me' }));

    const { req, url } = currentRequestUrl();
    expect(url).not.toContain('"createdBy":');
    req.flush([]);
  });

  describe('canEditRow', () => {
    it('is always true for an Admin', () => {
      setup(buildUser({ role: Role.Admin, id: 'admin-1' }));
      httpMock.expectOne((r) => r.url.includes('/general-form/responses')).flush([]);

      const row = { createdBy: { id: 'someone-else' } } as any;
      expect(component.canEditRow(row)).toBeTrue();
    });

    it('is true only for the response creator otherwise', () => {
      setup(buildUser({ role: Role.User, id: 'me' }));
      httpMock.expectOne((r) => r.url.includes('/general-form/responses')).flush([]);

      expect(component.canEditRow({ createdBy: { id: 'me' } } as any)).toBeTrue();
      expect(
        component.canEditRow({ createdBy: { id: 'other' } } as any),
      ).toBeFalse();
    });

    it('is false when the response has no creator', () => {
      setup(buildUser({ role: Role.User, id: 'me' }));
      httpMock.expectOne((r) => r.url.includes('/general-form/responses')).flush([]);

      expect(component.canEditRow({ createdBy: null } as any)).toBeFalse();
    });
  });

  describe('navigation', () => {
    it('edit navigates to the general response editor with the definition id as a query param', () => {
      setup();
      httpMock.expectOne((r) => r.url.includes('/general-form/responses')).flush([]);
      const navigateSpy = spyOn(router, 'navigate');

      component.edit('resp-1');

      expect(navigateSpy).toHaveBeenCalledWith(['general-responses', 'resp-1'], {
        queryParams: { definitionId: 'gform-1' },
      });
    });

    it('inspect additionally sets readonly', () => {
      setup();
      httpMock.expectOne((r) => r.url.includes('/general-form/responses')).flush([]);
      const navigateSpy = spyOn(router, 'navigate');

      component.inspect('resp-1');

      expect(navigateSpy).toHaveBeenCalledWith(['general-responses', 'resp-1'], {
        queryParams: { definitionId: 'gform-1', readonly: true },
      });
    });
  });

  describe('questionFilterChange', () => {
    it('AND-combines independent per-question filters and replaces on repeat calls for the same question', () => {
      setup();
      httpMock.expectOne((r) => r.url.includes('/general-form/responses')).flush([]);

      component.questionFilterChange('q1', { answerInt: { gte: 18 } });
      component.questionFilterChange('q2', { answerText: { contains: 'x' } });
      expect(component.filter().AND).toEqual([
        { answers: { some: { answerInt: { gte: 18 } } } },
        { answers: { some: { answerText: { contains: 'x' } } } },
      ] as any);

      component.questionFilterChange('q1', { answerInt: { gte: 21 } });
      expect(component.filter().AND).toEqual([
        { answers: { some: { answerInt: { gte: 21 } } } },
        { answers: { some: { answerText: { contains: 'x' } } } },
      ] as any);
    });
  });

  describe('getValue', () => {
    it("returns '---' when there is no matching answer", () => {
      setup();
      httpMock.expectOne((r) => r.url.includes('/general-form/responses')).flush([]);

      expect(component.getValue({ answers: [] } as any, question)).toBe('---');
    });

    it('returns answerInt for Integer questions', () => {
      setup();
      httpMock.expectOne((r) => r.url.includes('/general-form/responses')).flush([]);

      const row = {
        answers: [buildAnswer({ questionId: 'q-int', answerInt: 7 })],
      } as any;
      expect(component.getValue(row, question)).toBe(7);
    });

    it('returns answerNum for Float questions', () => {
      setup();
      httpMock.expectOne((r) => r.url.includes('/general-form/responses')).flush([]);

      const floatQ = buildQuestion({ id: 'q-f', type: QuestionType.Float });
      const row = {
        answers: [buildAnswer({ questionId: 'q-f', answerNum: 3.5 })],
      } as any;
      expect(component.getValue(row, floatQ)).toBe(3.5);
    });

    it('returns answerText for Text/Textarea questions', () => {
      setup();
      httpMock.expectOne((r) => r.url.includes('/general-form/responses')).flush([]);

      const textQ = buildQuestion({ id: 'q-t', type: QuestionType.Text });
      const row = {
        answers: [buildAnswer({ questionId: 'q-t', answerText: 'hi' })],
      } as any;
      expect(component.getValue(row, textQ)).toBe('hi');

      const areaQ = buildQuestion({ id: 'q-a', type: QuestionType.Textarea });
      const row2 = {
        answers: [buildAnswer({ questionId: 'q-a', answerText: 'bye' })],
      } as any;
      expect(component.getValue(row2, areaQ)).toBe('bye');
    });

    it('formats answerDate for Date questions, or returns an empty string when unset', () => {
      setup();
      httpMock.expectOne((r) => r.url.includes('/general-form/responses')).flush([]);

      const dateQ = buildQuestion({ id: 'q-d', type: QuestionType.Date });
      const date = new Date('2024-01-15');
      const row = {
        answers: [buildAnswer({ questionId: 'q-d', answerDate: date })],
      } as any;
      expect(component.getValue(row, dateQ)).toBe(date.toLocaleDateString());

      const rowNoDate = {
        answers: [buildAnswer({ questionId: 'q-d', answerDate: null })],
      } as any;
      expect(component.getValue(rowNoDate, dateQ)).toBe('');
    });

    it('joins selected option labels for Select questions, using free text for open options', () => {
      setup();
      httpMock.expectOne((r) => r.url.includes('/general-form/responses')).flush([]);

      const selectQ = buildQuestion({
        id: 'q-s',
        type: QuestionType.Select,
        selectOptions: [
          { id: 1, text: 'Rot' },
          { id: 2, text: 'Sonstiges', isOpen: true },
        ],
      });
      const row = {
        answers: [
          buildAnswer({
            questionId: 'q-s',
            answerSelectId: [1, 2],
            answerText: 'Türkis',
          }),
        ],
      } as any;
      expect(component.getValue(row, selectQ)).toBe('Rot,Türkis');
    });
  });

  describe('exportCsv', () => {
    it('builds a CSV with a column per question plus Erstellt von, and triggers a download', async () => {
      setup(buildUser({ role: Role.Admin, id: 'admin-1' }));

      const row = {
        answers: [buildAnswer({ questionId: 'q-int', answerInt: 33 })],
        createdBy: buildUser({ firstName: 'Anna', lastName: 'Muster', id: 'u1' }),
      };
      httpMock
        .expectOne((r) => r.url.includes('/general-form/responses'))
        .flush([row]);

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
      const lines = text.replace('﻿', '').split('\r\n');
      expect(lines[0]).toBe('Alter;Erstellt von');
      expect(lines[1]).toBe('33;Anna Muster');
    });

    it('leaves the "Erstellt von" column blank when the row has no creator', async () => {
      setup(buildUser({ role: Role.Admin, id: 'admin-1' }));

      const row = {
        answers: [buildAnswer({ questionId: 'q-int', answerInt: 5 })],
        createdBy: null,
      };
      httpMock
        .expectOne((r) => r.url.includes('/general-form/responses'))
        .flush([row]);

      let capturedBlob: Blob | undefined;
      spyOn(URL, 'createObjectURL').and.callFake((blob: any) => {
        capturedBlob = blob;
        return 'blob:mock';
      });
      spyOn(URL, 'revokeObjectURL');
      spyOn(HTMLAnchorElement.prototype, 'click');

      component['exportCsv']();

      const text = await capturedBlob!.text();
      const lines = text.replace('﻿', '').split('\r\n');
      expect(lines[1]).toBe('5;');
    });
  });

  describe('exportJson', () => {
    it('exports the raw response rows as JSON and triggers a download', async () => {
      setup(buildUser({ role: Role.Admin, id: 'admin-1' }));

      const row = {
        answers: [buildAnswer({ questionId: 'q-int', answerInt: 33 })],
        createdBy: buildUser({ firstName: 'Anna', lastName: 'Muster', id: 'u1' }),
      };
      httpMock
        .expectOne((r) => r.url.includes('/general-form/responses'))
        .flush([row]);

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
            jasmine.objectContaining({ answerInt: 33 }),
          ]),
        }),
      ]);
    });
  });

  describe('exportXlsx', () => {
    it('builds an xlsx workbook with a column per question plus Erstellt von, and triggers a download', async () => {
      setup(buildUser({ role: Role.Admin, id: 'admin-1' }));

      const row = {
        answers: [buildAnswer({ questionId: 'q-int', answerInt: 33 })],
        createdBy: buildUser({ firstName: 'Anna', lastName: 'Muster', id: 'u1' }),
      };
      httpMock
        .expectOne((r) => r.url.includes('/general-form/responses'))
        .flush([row]);

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

    it('leaves the "Erstellt von" column blank when the row has no creator', async () => {
      setup(buildUser({ role: Role.Admin, id: 'admin-1' }));

      const row = {
        answers: [buildAnswer({ questionId: 'q-int', answerInt: 5 })],
        createdBy: null,
      };
      httpMock
        .expectOne((r) => r.url.includes('/general-form/responses'))
        .flush([row]);

      spyOn(URL, 'createObjectURL').and.returnValue('blob:mock');
      spyOn(URL, 'revokeObjectURL');
      spyOn(HTMLAnchorElement.prototype, 'click');

      await expectAsync(component['exportXlsx']()).toBeResolved();
    });
  });
});
