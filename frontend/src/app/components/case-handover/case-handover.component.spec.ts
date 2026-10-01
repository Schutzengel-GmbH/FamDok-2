import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import Keycloak from 'keycloak-js';

import { CaseHandoverComponent } from './case-handover.component';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { flushSettings } from 'src/app/testing/http-helpers';
import { buildUser } from 'src/app/testing/fixtures';
import { environment } from 'src/environments/environment';
import { Role } from '../../../../../shared/generated/prisma/enums';

describe('CaseHandoverComponent', () => {
  let component: CaseHandoverComponent;
  let fixture: ComponentFixture<CaseHandoverComponent>;
  let httpMock: HttpTestingController;

  function setup(me: ReturnType<typeof buildUser>, responsibleIds: string[]) {
    TestBed.configureTestingModule({
      imports: [CaseHandoverComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Keycloak, useValue: mockKeycloak() },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CaseHandoverComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('selectedCase', {
      id: 'case-1',
      organisationId: 'org-1',
      subOrganisationId: 'sub-1',
      responsibleUsers: responsibleIds.map((id) => ({ id })),
    } as any);

    fixture.detectChanges();
    flushSettings(httpMock);
    httpMock.expectOne(`${environment.apiUrl}/me`).flush(me);
    // Rendering the mode's branch subscribes to its user list via AsyncPipe.
    fixture.detectChanges();
  }

  afterEach(() => httpMock.verify());

  describe('own handover', () => {
    const me = buildUser({ id: 'me', organisationId: 'org-1' });

    beforeEach(() => {
      setup(me, ['me']);
      httpMock
        .expectOne((r) => r.url.includes(`/user/org/${me.organisationId}`))
        .flush([{ id: 'other-user' }]);
      fixture.detectChanges();
    });

    it('uses the own mode for responsible users and renders a SelectUser', () => {
      expect(component['mode']()).toBe('own');
      expect(fixture.nativeElement.querySelector('app-select-user')).toBeTruthy();
    });

    it('requires at least one responsible user when removing the last one without a replacement', () => {
      component['removeMe'].set(true);

      expect(component.error()).toContain('Mindestens eine Fachkraft');
    });

    it('has no error when a replacement is chosen', () => {
      component['removeMe'].set(true);
      component['user'].set(buildUser({ id: 'new-user' }) as any);

      expect(component.error()).toBe('');
    });

    it('handover posts the change and emits changes on success', () => {
      let changed: unknown;
      component.changes.subscribe((c) => (changed = c));
      component['removeMe'].set(true);
      component['user'].set(buildUser({ id: 'new-user' }) as any);

      component.handover();

      const req = httpMock.expectOne(`${environment.apiUrl}/case/handover`);
      expect(req.request.body.removedIds).toEqual(['me']);
      expect(req.request.body.addedIds).toEqual(['new-user']);
      req.flush({});

      expect(changed).toEqual({ userRemoved: true });
    });
  });

  describe('coordinator handover', () => {
    function setupCoordinator(me: ReturnType<typeof buildUser>) {
      setup(me, ['a', 'b']);
      httpMock.expectOne((r) => r.url.includes('/user/org/org-1')).flush([]);
    }

    it('uses the coordinator mode for org coordinators of the case org', () => {
      setupCoordinator(
        buildUser({ id: 'me', role: Role.OrgCoordinator, organisationId: 'org-1' }),
      );

      expect(component['mode']()).toBe('coordinator');
    });

    it('uses the coordinator mode for subOrg coordinators of the case subOrg', () => {
      setupCoordinator(
        buildUser({
          id: 'me',
          role: Role.SubOrgCoordinator,
          organisationId: 'org-1',
          subOrganisations: [{ id: 'sub-1' }],
        }),
      );

      expect(component['mode']()).toBe('coordinator');
    });

    it('requires at least one responsible user after the handover', () => {
      setupCoordinator(
        buildUser({ id: 'me', role: Role.OrgCoordinator, organisationId: 'org-1' }),
      );

      component['toggleRemoved']('a', true);
      component['toggleRemoved']('b', true);
      expect(component.error()).toContain('Mindestens eine Fachkraft');

      component['addedUsers'].set([buildUser({ id: 'c' }) as any]);
      expect(component.error()).toBe('');
    });

    it('posts multiple added and removed users and never reports userRemoved', () => {
      setupCoordinator(
        buildUser({ id: 'a', role: Role.OrgCoordinator, organisationId: 'org-1' }),
      );
      let changed: unknown;
      component.changes.subscribe((c) => (changed = c));
      component['toggleRemoved']('a', true);
      component['toggleRemoved']('b', true);
      component['addedUsers'].set([
        buildUser({ id: 'c' }) as any,
        buildUser({ id: 'd' }) as any,
      ]);

      component.handover();

      const req = httpMock.expectOne(`${environment.apiUrl}/case/handover`);
      expect(req.request.body.removedIds).toEqual(['a', 'b']);
      expect(req.request.body.addedIds).toEqual(['c', 'd']);
      req.flush({});

      expect(changed).toEqual({ userRemoved: false });
      expect(component['removedIds']()).toEqual([]);
      expect(component['addedUsers']()).toEqual([]);
    });
  });

  it('shows no handover UI for users that are neither responsible nor coordinator', () => {
    setup(buildUser({ id: 'me', organisationId: 'org-1' }), ['someone-else']);

    expect(component['mode']()).toBe('none');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});
