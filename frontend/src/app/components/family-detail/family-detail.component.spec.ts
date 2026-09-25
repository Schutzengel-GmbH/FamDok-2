import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Location } from '@angular/common';
import Keycloak from 'keycloak-js';

import { FamilyDetailComponent } from './family-detail.component';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { flushSettings } from 'src/app/testing/http-helpers';
import { ToastService } from 'src/app/services/toast.service';
import { environment } from 'src/environments/environment';

describe('FamilyDetailComponent', () => {
  let component: FamilyDetailComponent;
  let fixture: ComponentFixture<FamilyDetailComponent>;
  let httpMock: HttpTestingController;
  let location: jasmine.SpyObj<Location>;

  const baseCase = {
    id: 'case-1',
    family: { children: [], caregiver: [] },
    contactDocumentation: [],
    zielvereinbarungen: [
      { id: 'ziel-1', topic: 'Wohnen', description: 'desc', status: 'inProgress', finishBy: new Date('2026-05-01') },
    ],
  };

  beforeEach(async () => {
    location = jasmine.createSpyObj('Location', ['back']);

    await TestBed.configureTestingModule({
      imports: [FamilyDetailComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Location, useValue: location },
        { provide: Keycloak, useValue: mockKeycloak() },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FamilyDetailComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('selectedCase', baseCase as any);
    fixture.detectChanges();
    flushSettings(httpMock);
    // The default stammdaten tab loads the current user to decide whether to show export buttons.
    httpMock
      .match((r) => r.url.endsWith('/me'))
      .forEach((r) => r.flush({ id: 'user-1', role: 'User', subOrganisations: [] }));
  });

  afterEach(() => httpMock.verify());

  it('defaults to the stammdaten tab', () => {
    expect(component['activeTab']()).toBe('stammdaten');
  });

  it('setTab switches the active tab and seeds the ziel list when switching to zielvereinbarungen', () => {
    component.setTab('zielvereinbarungen');

    expect(component['activeTab']()).toBe('zielvereinbarungen');
    expect(component['zielList']()).toEqual([
      jasmine.objectContaining({ id: 'ziel-1', topic: 'Wohnen', status: 'inProgress' }),
    ]);
  });

  it('goBack navigates back in browser history', () => {
    component.goBack();

    expect(location.back).toHaveBeenCalled();
  });

  describe('getAdressString', () => {
    it('formats a full address', () => {
      expect(
        component.getAdressString({ street: 'Hauptstr.', number: '1', plz: '12345', city: 'Berlin' }),
      ).toBe('Hauptstr. 1, 12345 Berlin');
    });

    it('falls back to a placeholder when there is no address', () => {
      expect(component.getAdressString(undefined)).toBe('Keine Adresse hinterlegt');
    });
  });

  describe('date formatting', () => {
    it('formatDateInput formats as yyyy-mm-dd', () => {
      expect(component.formatDateInput(new Date('2026-03-05'))).toBe('2026-03-05');
    });

    it('formatDateDisplay formats as a German locale date', () => {
      expect(component.formatDateDisplay(new Date('2026-03-05'))).toBe(
        new Date('2026-03-05').toLocaleDateString('de-DE'),
      );
    });

    it('both return an empty string for an undefined date', () => {
      expect(component.formatDateInput(undefined)).toBe('');
      expect(component.formatDateDisplay(undefined)).toBe('');
    });
  });

  describe('zielStatusKind / zielDotClass / zielBadgeClass', () => {
    it('classifies a failed-like status as red', () => {
      expect(component.zielStatusKind('failed')).toBe('red');
      expect(component.zielDotClass('failed')).toContain('red');
      expect(component.zielBadgeClass('failed')).toContain('red');
    });

    it('classifies an in-progress status as yellow', () => {
      expect(component.zielStatusKind('inProgress')).toBe('yellow');
    });

    it('classifies a done status as green', () => {
      expect(component.zielStatusKind('done')).toBe('green');
    });

    it('classifies an empty/unknown status as gray', () => {
      expect(component.zielStatusKind('')).toBe('gray');
      expect(component.zielStatusKind('mystery')).toBe('gray');
    });
  });

  describe('refreshCaseFromBackend', () => {
    it('reloads the case and re-seeds the ziel list', () => {
      const updated = { ...baseCase, family: { children: [{ id: 'child-1' }], caregiver: [] } };

      component.refreshCaseFromBackend();

      httpMock.expectOne(`${environment.apiUrl}/case/i/case-1`).flush(updated as any);

      expect(component.selectedCase()).toEqual(updated as any);
      expect(component['selectedChildId']()).toBe('child-1');
    });

    it('does nothing when there is no selected case', () => {
      fixture.componentRef.setInput('selectedCase', undefined);

      component.refreshCaseFromBackend();

      expect(httpMock.match(() => true).length).toBe(0);
    });

    it('switches to the given target tab after reloading', () => {
      component.refreshCaseFromBackend('close');

      httpMock.expectOne(`${environment.apiUrl}/case/i/case-1`).flush(baseCase as any);

      expect(component['activeTab']()).toBe('close');
    });

    it('does not auto-select a child when not on stammdaten or a child is already selected', () => {
      component.setTab('zielvereinbarungen');
      const updated = { ...baseCase, family: { children: [{ id: 'child-1' }], caregiver: [] } };

      component.refreshCaseFromBackend();

      httpMock.expectOne(`${environment.apiUrl}/case/i/case-1`).flush(updated as any);

      expect(component['selectedChildId']()).toBeUndefined();
    });

    it('shows an error toast when the reload fails', () => {
      const toast = TestBed.inject(ToastService);

      component.refreshCaseFromBackend();

      httpMock
        .expectOne(`${environment.apiUrl}/case/i/case-1`)
        .flush('Boom', { status: 500, statusText: 'Server Error' });

      expect(toast.toasts()[0].severity).toBe('danger');
    });
  });

  describe('responsibleUsersChanged', () => {
    it('refreshes the case on the fachkraft tab when a user was added', () => {
      component.responsibleUsersChanged(false);

      httpMock.expectOne(`${environment.apiUrl}/case/i/case-1`).flush(baseCase as any);

      expect(component['activeTab']()).toBe('fachkraft');
    });

    it('goes back when the current user removed themselves', () => {
      component.responsibleUsersChanged(true);

      expect(location.back).toHaveBeenCalled();
    });
  });

  it('redirects the "formulare" tab to stammdaten when read-only', () => {
    fixture.componentRef.setInput('readOnly', true);
    fixture.componentRef.setInput('initialTab', 'formulare');

    expect(component['activeTab']()).toBe('stammdaten');
  });

  describe('zielDotClass / zielBadgeClass', () => {
    it('reflect the yellow status', () => {
      expect(component.zielDotClass('offen')).toContain('yellow');
      expect(component.zielBadgeClass('offen')).toContain('yellow');
    });

    it('reflect the green status', () => {
      expect(component.zielDotClass('erledigt')).toContain('green');
      expect(component.zielBadgeClass('erledigt')).toContain('green');
    });

    it('fall back to the plain class for gray/unknown status', () => {
      expect(component.zielDotClass('')).toBe('status-dot');
      expect(component.zielBadgeClass('')).toBe('badge-soft');
    });
  });

  it('openZielFormNew resets the form and opens it in create mode', () => {
    component['zielEditingId'].set('ziel-1');
    component['zielTopic'].set('stale');

    component.openZielFormNew();

    expect(component['zielEditingId']()).toBeNull();
    expect(component['zielTopic']()).toBe('');
    expect(component['zielFormOpen']()).toBeTrue();
  });

  describe('seedZieleFromCase (via setTab)', () => {
    it('does not reseed the same case unless forced', () => {
      component.setTab('zielvereinbarungen');
      component['zielList'].set([]);

      component['seedZieleFromCase']();

      expect(component['zielList']()).toEqual([]);
    });

    it('falls back to dueDate, then defaults status to "offen" when neither is set', () => {
      fixture.componentRef.setInput('selectedCase', {
        ...baseCase,
        zielvereinbarungen: [
          { topic: 'A', description: 'd', dueDate: new Date('2026-06-01') },
        ],
      });

      component.setTab('zielvereinbarungen');

      const [item] = component['zielList']();
      expect(item.status).toBe('offen');
      expect(item.targetDate).toEqual(new Date('2026-06-01'));
      expect(item.id).toBe('A-undefined-d');
    });
  });

  describe('selectedChild', () => {
    it('is undefined when no child is selected', () => {
      expect(component['selectedChild']()).toBeUndefined();
    });

    it('returns the matching child once selected', () => {
      fixture.componentRef.setInput('selectedCase', {
        ...baseCase,
        family: { children: [{ id: 'child-1', name: 'Max' }], caregiver: [] },
      });
      component['selectedChildId'].set('child-1');

      expect(component['selectedChild']()).toEqual(
        jasmine.objectContaining({ id: 'child-1' }),
      );
    });
  });
});
