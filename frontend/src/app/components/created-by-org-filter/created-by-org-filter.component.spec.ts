import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import Keycloak from 'keycloak-js';

import { CreatedByOrgFilter } from './created-by-org-filter.component';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { flushSettings } from 'src/app/testing/http-helpers';
import { environment } from 'src/environments/environment';

describe('CreatedByOrgFilter', () => {
  let component: CreatedByOrgFilter;
  let fixture: ComponentFixture<CreatedByOrgFilter>;
  let httpMock: HttpTestingController;
  let modal: jasmine.SpyObj<NgbModal>;

  const orgs = [
    {
      id: 'org-1',
      name: 'Org 1',
      subOrganisations: [{ id: 'sub-1', name: 'Sub 1' }],
    },
    { id: 'org-2', name: 'Org 2', subOrganisations: [] },
  ];

  beforeEach(async () => {
    modal = jasmine.createSpyObj('NgbModal', ['open']);

    await TestBed.configureTestingModule({
      imports: [CreatedByOrgFilter],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Keycloak, useValue: mockKeycloak() },
        { provide: NgbModal, useValue: modal },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CreatedByOrgFilter);
    component = fixture.componentInstance;
    fixture.detectChanges();
    flushSettings(httpMock);
    httpMock.expectOne(`${environment.apiUrl}/org`).flush(orgs as any);
  });

  afterEach(() => httpMock.verify());

  it('should create inactive', () => {
    expect(component).toBeTruthy();
    expect(component.active()).toBeFalse();
  });

  it('apply emits an organisation filter and activates when an org is picked', () => {
    let emitted: unknown;
    component.filterChanged.subscribe((f) => (emitted = f));
    component['organisationId'] = 'org-1';

    component.apply();

    expect(component.active()).toBeTrue();
    expect(emitted).toEqual({ organisationId: 'org-1' });
  });

  it('apply also includes the sub-organisation when picked', () => {
    let emitted: unknown;
    component.filterChanged.subscribe((f) => (emitted = f));
    component['organisationId'] = 'org-1';
    component['subOrganisationId'] = 'sub-1';

    component.apply();

    expect(emitted).toEqual({
      organisationId: 'org-1',
      subOrganisations: { some: { id: 'sub-1' } },
    });
  });

  it('apply does not activate when nothing is picked', () => {
    component.apply();

    expect(component.active()).toBeFalse();
  });

  it('changing the org resets the picked sub-organisation', () => {
    component['organisationId'] = 'org-1';
    component['subOrganisationId'] = 'sub-1';

    component['onOrgChange']();

    expect(component['subOrganisationId']).toBeUndefined();
  });

  it('availableSubOrgs reflects the sub-organisations of the selected org', () => {
    component['organisationId'] = 'org-1';

    expect(component['availableSubOrgs']).toEqual(orgs[0].subOrganisations as any);
  });

  it('cancel resets the filter and emits an empty filter', () => {
    let emitted: unknown;
    component['organisationId'] = 'org-1';
    component.apply();
    component.filterChanged.subscribe((f) => (emitted = f));

    component.cancel();

    expect(component.active()).toBeFalse();
    expect(component['organisationId']).toBeUndefined();
    expect(component['subOrganisationId']).toBeUndefined();
    expect(emitted).toEqual({});
  });

  describe('open', () => {
    it('applies the filter when the modal resolves with "apply"', async () => {
      modal.open.and.returnValue({ result: Promise.resolve('apply') } as any);
      const applySpy = spyOn(component, 'apply');

      component.open({} as any);
      await fixture.whenStable();

      expect(applySpy).toHaveBeenCalled();
    });

    it('cancels the filter when the modal resolves with anything else', async () => {
      modal.open.and.returnValue({
        result: Promise.resolve('dismiss'),
      } as any);
      const cancelSpy = spyOn(component, 'cancel');

      component.open({} as any);
      await fixture.whenStable();

      expect(cancelSpy).toHaveBeenCalled();
    });
  });
});
