import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import Keycloak from 'keycloak-js';

import { TabClose } from './tab-close.component';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { WarningType, FormType } from '../../../../../../shared/consts';
import { Role } from '../../../../../../shared/generated/prisma/enums';

describe('TabClose', () => {
  let component: TabClose;
  let fixture: ComponentFixture<TabClose>;
  let httpMock: HttpTestingController;

  function setup(
    warnings: unknown[] = [],
    me: Record<string, unknown> = {
      id: 'user-1',
      role: Role.Admin,
      organisationId: null,
      subOrganisations: [],
    },
  ) {
    TestBed.configureTestingModule({
      imports: [TabClose],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Keycloak, useValue: mockKeycloak() },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TabClose);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('selectedCase', { id: 'case-1', closedAt: null } as any);
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url.includes('/warnings')).flush(warnings);
    httpMock
      .expectOne((r) => r.url.includes('/settings'))
      .flush([{ name: 'closing_doc', value: 'form-1' }]);
    httpMock.expectOne((r) => r.url.includes('/me')).flush(me);
  }

  afterEach(() => httpMock.verify());

  it('onDateSelect updates the working date', () => {
    setup();

    component.onDateSelect({ target: { value: '2026-03-01' } } as unknown as Event);

    expect(component.date()).toEqual(new Date('2026-03-01'));
  });

  it('has no tooltip when there are no relevant warnings', () => {
    setup();

    expect(component['closingDocWarningTooltip']()).toBeUndefined();
  });

  it('shows a tooltip when the case was closed without a closing doc', () => {
    setup([
      {
        type: WarningType.CLOSED_WITHOUT_DOC,
        data: { caseId: 'case-1', closedAt: new Date('2026-01-15') },
      },
    ]);

    expect(component['closingDocWarningTooltip']()).toContain('geschlossen');
  });

  it('shows a tooltip when the closing doc response is unfinished', () => {
    setup([
      {
        type: WarningType.UNFINISHED_FORM,
        data: { caseId: 'case-1', formType: FormType.CASE_FORM, caseFormId: 'form-1' },
      },
    ]);

    expect(component['closingDocWarningTooltip']()).toContain('unvollständig');
  });

  it('close is a no-op when readOnly', () => {
    setup();
    fixture.componentRef.setInput('readOnly', true);

    component.close();

    expect(httpMock.match((r) => r.url.includes('/case/close')).length).toBe(0);
  });

  it('close creates the closing doc flow for an open case, then navigates', () => {
    setup();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    component.close();

    // SettingsService caches its response (shareReplay), so the second getSettings() call
    // inside close() replays it without a new HTTP request - only the close POST goes out.
    httpMock
      .expectOne((r) => r.url.includes('/case/close/case-1'))
      .flush({ id: 'case-1', personalDataDueAt: null });

    expect(router.navigate).toHaveBeenCalledWith(['responses', 'form-1'], {
      queryParams: { caseId: 'case-1' },
    });
  });

  it('close only emits `changed` (no navigation) when just changing the date on an already-closed case', () => {
    setup();
    fixture.componentRef.setInput('selectedCase', {
      id: 'case-1',
      closedAt: new Date('2026-01-01'),
    } as any);
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    const changedSpy = jasmine.createSpy('changed');
    component.changed.subscribe(changedSpy);

    component.close();

    httpMock
      .expectOne((r) => r.url.includes('/case/close/case-1'))
      .flush({ id: 'case-1', personalDataDueAt: '2026-09-25T00:00:00.000Z' });

    expect(router.navigate).not.toHaveBeenCalled();
    expect(changedSpy).toHaveBeenCalled();
  });

  it('reopen is a no-op when readOnly', () => {
    setup();
    fixture.componentRef.setInput('readOnly', true);

    component.reopen();

    expect(httpMock.match((r) => r.url.includes('/case/reopen')).length).toBe(0);
  });

  describe('canPurge', () => {
    it('is true for Admin', () => {
      setup([], { id: 'user-1', role: Role.Admin, organisationId: null, subOrganisations: [] });
      fixture.componentRef.setInput('selectedCase', {
        id: 'case-1',
        closedAt: null,
        family: { organisationId: 'org-1' },
      } as any);

      expect(component['canPurge']()).toBe(true);
    });

    it('is false for a plain User even if responsible for the case', () => {
      setup([], { id: 'user-1', role: Role.User, organisationId: 'org-1', subOrganisations: [] });
      fixture.componentRef.setInput('selectedCase', {
        id: 'case-1',
        closedAt: null,
        family: { organisationId: 'org-1' },
      } as any);

      expect(component['canPurge']()).toBe(false);
    });

    it('is true for an OrgCoordinator within their own org, false for another org', () => {
      setup([], {
        id: 'user-1',
        role: Role.OrgCoordinator,
        organisationId: 'org-1',
        subOrganisations: [],
      });
      fixture.componentRef.setInput('selectedCase', {
        id: 'case-1',
        closedAt: null,
        family: { organisationId: 'org-1' },
      } as any);
      expect(component['canPurge']()).toBe(true);

      fixture.componentRef.setInput('selectedCase', {
        id: 'case-1',
        closedAt: null,
        family: { organisationId: 'org-2' },
      } as any);
      expect(component['canPurge']()).toBe(false);
    });
  });
});
