import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import Keycloak from 'keycloak-js';

import { ContactDocumentationTable } from './contact-documentation-table.component';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { buildUser } from 'src/app/testing/fixtures';
import { ToastService } from 'src/app/services/toast.service';
import { environment } from 'src/environments/environment';
import { Role } from '../../../../../shared/generated/prisma/enums';

describe('ContactDocumentationTable', () => {
  let component: ContactDocumentationTable;
  let fixture: ComponentFixture<ContactDocumentationTable>;
  let httpMock: HttpTestingController;
  let router: Router;
  let toast: ToastService;

  function buildDoc(overrides: Record<string, any> = {}) {
    return {
      id: 'doc-1',
      caseId: 'case-1',
      date: new Date('2026-02-01'),
      duration: 30,
      artDerBetreuung: 0,
      beratungsThemenEltern: [],
      beratungsThemenKinder: [],
      beratungsThemenAllgemein: [],
      zusammenfassung: 'Zusammenfassung',
      case: { id: 'case-1', responsibleUsers: [{ id: 'me' }] },
      createdBy: null,
      ...overrides,
    };
  }

  function setup(user = buildUser({ role: Role.User, id: 'me' })) {
    TestBed.configureTestingModule({
      imports: [ContactDocumentationTable],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Keycloak, useValue: mockKeycloak() },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    toast = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(ContactDocumentationTable);
    component = fixture.componentInstance;
    fixture.detectChanges();
    httpMock.expectOne(`${environment.apiUrl}/me`).flush(user);
    httpMock.expectOne(`${environment.apiUrl}/org`).flush([]);
    return user;
  }

  function flushDocsRequest(docs: any[] = []) {
    httpMock
      .expectOne((r) => r.url.includes('/documentation/'))
      .flush(docs);
  }

  afterEach(() => httpMock.verify());

  describe('role-based data source', () => {
    it('uses /documentation/my for a plain User', () => {
      setup(buildUser({ role: Role.User, id: 'me' }));
      const req = httpMock.expectOne((r) => r.url.includes('/documentation/my'));
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('uses /documentation/all for Admin', () => {
      setup(buildUser({ role: Role.Admin, id: 'me' }));
      const req = httpMock.expectOne((r) => r.url.includes('/documentation/all'));
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('uses /documentation/all for Controller', () => {
      setup(buildUser({ role: Role.Controller, id: 'me' }));
      const req = httpMock.expectOne((r) => r.url.includes('/documentation/all'));
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('scopes to the organisation for OrgController/OrgCoordinator', () => {
      setup(
        buildUser({ role: Role.OrgCoordinator, id: 'me', organisationId: 'org-9' }),
      );
      const req = httpMock.expectOne((r) => r.url.includes('/documentation/all'));
      expect(decodeURIComponent(req.request.url)).toContain(
        '"organisation":{"id":"org-9"}',
      );
      req.flush([]);
    });

    it('scopes to sub-organisations for a SubOrgCoordinator', () => {
      setup(
        buildUser({
          role: Role.SubOrgCoordinator,
          id: 'me',
          subOrganisations: [{ id: 'sub-1' }],
        }),
      );
      const req = httpMock.expectOne((r) => r.url.includes('/documentation/all'));
      expect(decodeURIComponent(req.request.url)).toContain(
        '"subOrganisationId":{"in":["sub-1"]}',
      );
      req.flush([]);
    });
  });

  describe('canEditRow', () => {
    it('is always true for Admin', () => {
      setup(buildUser({ role: Role.Admin, id: 'me' }));
      flushDocsRequest();

      expect(
        component.canEditRow(
          buildDoc({ case: { responsibleUsers: [{ id: 'other' }] } }) as any,
        ),
      ).toBeTrue();
    });

    it('is true only for a case responsibleUser otherwise', () => {
      setup(buildUser({ role: Role.User, id: 'me' }));
      flushDocsRequest();

      expect(
        component.canEditRow(
          buildDoc({ case: { responsibleUsers: [{ id: 'me' }] } }) as any,
        ),
      ).toBeTrue();
      expect(
        component.canEditRow(
          buildDoc({ case: { responsibleUsers: [{ id: 'other' }] } }) as any,
        ),
      ).toBeFalse();
    });
  });

  describe('toggleEdit / columnEditable', () => {
    it('initializes and toggles the date flag independently of the response flags', () => {
      setup();
      flushDocsRequest();

      expect(component.columnEditable('date')).toBeFalse();
      component.toggleEdit('doc-1', 'date');
      expect(component.editable['doc-1'].date).toBeTrue();
      expect(component.columnEditable('date')).toBeTrue();
      expect(component.columnEditable('duration')).toBeFalse();

      component.toggleEdit('doc-1', 'date');
      expect(component.editable['doc-1'].date).toBeFalse();
    });

    it('toggles a response field flag', () => {
      setup();
      flushDocsRequest();

      component.toggleEdit('doc-1', 'duration');
      expect(component.editable['doc-1'].response.duration).toBeTrue();
      expect(component.columnEditable('duration')).toBeTrue();
    });
  });

  describe('userEvent (double click to edit)', () => {
    it('is a no-op for anything other than a dblclick', () => {
      setup();
      flushDocsRequest();

      component.userEvent({ type: 'click' } as any);
      expect(component.editable['doc-1']).toBeUndefined();
    });

    it('is a no-op when the user cannot edit the row', () => {
      setup(buildUser({ role: Role.User, id: 'me' }));
      flushDocsRequest();
      const row = buildDoc({ case: { responsibleUsers: [{ id: 'other' }] } });

      component.userEvent({
        type: 'dblclick',
        row,
        column: { prop: 'date' },
      } as any);

      expect(component.editable[row.id]).toBeUndefined();
    });

    it('toggles the date field on dblclick of the date column', () => {
      setup();
      flushDocsRequest();
      const row = buildDoc();

      component.userEvent({
        type: 'dblclick',
        row,
        column: { prop: 'date' },
      } as any);

      expect(component.editable['doc-1'].date).toBeTrue();
    });

    it('toggles the matching response field on dblclick of a response.* column', () => {
      setup();
      flushDocsRequest();
      const row = buildDoc();

      component.userEvent({
        type: 'dblclick',
        row,
        column: { prop: 'response.duration' },
      } as any);

      expect(component.editable['doc-1'].response.duration).toBeTrue();
    });
  });

  describe('filter methods', () => {
    it('caseFilterChange sets the case portion of the filter', () => {
      setup();
      flushDocsRequest();

      component.caseFilterChange({ city: { contains: 'Köln' } } as any);
      expect(component['filter']().case).toEqual({
        city: { contains: 'Köln' },
      } as any);
    });

    it('dateFilterChanged sets/clears the date filter', () => {
      setup();
      flushDocsRequest();

      component.dateFilterChanged({ filter: 'gte', value: '2026-01-01' } as any);
      expect(component['filter']().date).toEqual({ gte: '2026-01-01' } as any);

      component.dateFilterChanged(undefined);
      expect(component['filter']().date).toBeUndefined();
    });

    it('zusammenfassungFilterChanged is a no-op for a falsy filter, otherwise sets a case-insensitive contains filter', () => {
      setup();
      flushDocsRequest();

      component.zusammenfassungFilterChanged(undefined);
      expect(component['filter']().zusammenfassung).toBeUndefined();

      component.zusammenfassungFilterChanged('Sucht');
      expect(component['filter']().zusammenfassung).toEqual({
        contains: 'Sucht',
        mode: 'insensitive',
      } as any);
    });

    it('filterChanged is a no-op when the filter value is undefined', () => {
      setup();
      flushDocsRequest();

      component.filterChanged('duration', undefined);
      expect(component['filter']().duration).toBeUndefined();
    });

    it('filterChanged sets duration directly', () => {
      setup();
      flushDocsRequest();

      component.filterChanged('duration', { gte: 15 } as any);
      expect(component['filter']().duration).toEqual({ gte: 15 } as any);
    });

    it('filterChanged sets artDerBetreuung directly', () => {
      setup();
      flushDocsRequest();

      component.filterChanged('artDerBetreuung', 2);
      expect(component['filter']().artDerBetreuung).toBe(2);
    });

    it('filterChanged wraps beratungsThemen* filters in a "has" clause', () => {
      setup();
      flushDocsRequest();

      component.filterChanged('beratungsThemenEltern', 1);
      expect(component['filter']().beratungsThemenEltern).toEqual({
        has: 1,
      } as any);
    });
  });

  describe('getSelectValue / getSelectOption / getSelectOptions', () => {
    it('resolves the single artDerBetreuung option text', () => {
      setup();
      flushDocsRequest();

      const row = buildDoc({ artDerBetreuung: 0 });
      expect(component.getSelectValue(row as any, 'artDerBetreuung')).toBe(
        'Hausbesuch',
      );
    });

    it('joins multiple beratungsThemenEltern option texts', () => {
      setup();
      flushDocsRequest();

      const row = buildDoc({ beratungsThemenEltern: [0, 1] });
      expect(
        component.getSelectValue(row as any, 'beratungsThemenEltern'),
      ).toBe('Sucht, Mangelnde Selbstfürsorge');
    });

    it('getSelectOption finds the artDerBetreuung option by id, or undefined', () => {
      setup();
      flushDocsRequest();

      expect(component.getSelectOption(0)?.text).toBe('Hausbesuch');
      expect(component.getSelectOption(undefined)).toBeUndefined();
      expect(component.getSelectOption(999)).toBeUndefined();
    });

    it('getSelectOptions resolves each id and drops unknown ones', () => {
      setup();
      flushDocsRequest();

      const options = component.getSelectOptions('beratungsThemenEltern', [
        0,
        999,
      ]);
      expect(options.length).toBe(1);
      expect(options[0].text).toBe('Sucht');
    });

    it('getSelectOptions returns an empty array for null/undefined ids', () => {
      setup();
      flushDocsRequest();

      expect(component.getSelectOptions('beratungsThemenEltern', null)).toEqual(
        [],
      );
      expect(
        component.getSelectOptions('beratungsThemenEltern', undefined),
      ).toEqual([]);
    });
  });

  describe('saveDate', () => {
    it('updates the row locally, saves, toggles edit off, and toasts success', () => {
      setup();
      const row = buildDoc();
      flushDocsRequest([row]);
      component.toggleEdit('doc-1', 'date');

      const newDate = new Date('2026-05-05');
      component.saveDate(row as any, newDate);

      const req = httpMock.expectOne(
        `${environment.apiUrl}/case/i/case-1/documentation/i/doc-1`,
      );
      expect(req.request.body.date).toEqual(newDate);
      req.flush({ ...row, date: newDate });

      expect(component.editable['doc-1'].date).toBeFalse();
      expect(toast.toasts()[0]).toEqual(
        jasmine.objectContaining({ title: 'Gespeichert', severity: 'success' }),
      );
    });

    it('toggles edit off and toasts an error on failure', () => {
      setup();
      const row = buildDoc();
      flushDocsRequest([row]);
      component.toggleEdit('doc-1', 'date');

      component.saveDate(row as any, new Date('2026-05-05'));

      const req = httpMock.expectOne(
        `${environment.apiUrl}/case/i/case-1/documentation/i/doc-1`,
      );
      req.flush('boom', { status: 500, statusText: 'Server Error' });

      expect(component.editable['doc-1'].date).toBeFalse();
      expect(toast.toasts()[0]).toEqual(
        jasmine.objectContaining({ title: 'Fehler', severity: 'danger' }),
      );
    });
  });

  describe('saveResponse', () => {
    it('throws when the row is not present in the currently loaded rows', () => {
      setup();
      flushDocsRequest([]);

      expect(() =>
        component.saveResponse(buildDoc() as any, 'duration', 45),
      ).toThrow();
    });

    it('stores the option id for artDerBetreuung and saves', () => {
      setup();
      const row = buildDoc();
      flushDocsRequest([row]);
      component.toggleEdit('doc-1', 'artDerBetreuung');

      component.saveResponse(row as any, 'artDerBetreuung', { id: 3, text: 'Begleitung' });

      const req = httpMock.expectOne(
        `${environment.apiUrl}/case/i/case-1/documentation/i/doc-1`,
      );
      expect(req.request.body.artDerBetreuung).toBe(3);
      req.flush({ ...row, artDerBetreuung: 3 });

      expect(component.editable['doc-1'].response.artDerBetreuung).toBeFalse();
      expect(toast.toasts()[0].severity).toBe('success');
    });

    it('stores a null option id for artDerBetreuung when cleared', () => {
      setup();
      const row = buildDoc();
      flushDocsRequest([row]);

      component.saveResponse(row as any, 'artDerBetreuung', null);

      const req = httpMock.expectOne(
        `${environment.apiUrl}/case/i/case-1/documentation/i/doc-1`,
      );
      expect(req.request.body.artDerBetreuung).toBeNull();
      req.flush({ ...row, artDerBetreuung: null });
    });

    it('stores an array of option ids for beratungsThemen* fields', () => {
      setup();
      const row = buildDoc();
      flushDocsRequest([row]);

      component.saveResponse(row as any, 'beratungsThemenEltern', [
        { id: 0, text: 'Sucht' },
        { id: 1, text: 'Mangelnde Selbstfürsorge' },
      ]);

      const req = httpMock.expectOne(
        `${environment.apiUrl}/case/i/case-1/documentation/i/doc-1`,
      );
      expect(req.request.body.beratungsThemenEltern).toEqual([0, 1]);
      req.flush({ ...row, beratungsThemenEltern: [0, 1] });
    });

    it('toasts an error and still resets the edit flag on failure', () => {
      setup();
      const row = buildDoc();
      flushDocsRequest([row]);
      component.toggleEdit('doc-1', 'duration');

      component.saveResponse(row as any, 'duration', 60);

      const req = httpMock.expectOne(
        `${environment.apiUrl}/case/i/case-1/documentation/i/doc-1`,
      );
      req.flush('boom', { status: 500, statusText: 'Server Error' });

      expect(component.editable['doc-1'].response.duration).toBeFalse();
      expect(toast.toasts()[0].severity).toBe('danger');
    });
  });

  describe('navigation', () => {
    it('edit navigates to the contact documentation editor', () => {
      setup();
      flushDocsRequest();
      const navigateSpy = spyOn(router, 'navigate');

      component.edit('doc-1', buildDoc() as any);

      expect(navigateSpy).toHaveBeenCalledWith([
        'contact-documentation',
        'case-1',
        'doc-1',
      ]);
    });

    it('inspect additionally passes readonly', () => {
      setup();
      flushDocsRequest();
      const navigateSpy = spyOn(router, 'navigate');

      component.inspect('doc-1', buildDoc() as any);

      expect(navigateSpy).toHaveBeenCalledWith(
        ['contact-documentation', 'case-1', 'doc-1'],
        { queryParams: { readonly: true } },
      );
    });
  });

  describe('exportCsv', () => {
    it('builds a CSV of all documentation columns and triggers a download', async () => {
      setup(buildUser({ role: Role.Admin, id: 'me' }));
      const row = buildDoc({
        case: {
          id: 'case-1',
          city: 'Berlin',
          startedAt: new Date('2026-01-01'),
          responsibleUsers: [],
        },
        createdBy: buildUser({ firstName: 'Anna', lastName: 'Muster' }),
      });
      flushDocsRequest([row]);

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
      expect(text).toContain('Zusammenfassung');
      expect(text).toContain('Anna Muster');
      expect(text).toContain('Hausbesuch');
    });
  });

  describe('exportJson', () => {
    it('exports the raw documentation rows as JSON and triggers a download', async () => {
      setup(buildUser({ role: Role.Admin, id: 'me' }));
      const row = buildDoc({ id: 'doc-1', zusammenfassung: 'Zusammenfassung' });
      flushDocsRequest([row]);

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
      expect(parsed).toEqual([jasmine.objectContaining({ id: 'doc-1', zusammenfassung: 'Zusammenfassung' })]);
    });
  });

  describe('exportXlsx', () => {
    it('builds an xlsx workbook of all documentation columns and triggers a download', async () => {
      setup(buildUser({ role: Role.Admin, id: 'me' }));
      const row = buildDoc({
        case: {
          id: 'case-1',
          city: 'Berlin',
          startedAt: new Date('2026-01-01'),
          responsibleUsers: [],
        },
        createdBy: buildUser({ firstName: 'Anna', lastName: 'Muster' }),
      });
      flushDocsRequest([row]);

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
