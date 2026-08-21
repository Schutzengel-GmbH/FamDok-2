import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import Keycloak from 'keycloak-js';

import { OrgSelectComponent } from './org-select';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { flushSettings } from 'src/app/testing/http-helpers';
import { environment } from 'src/environments/environment';

describe('OrgSelect', () => {
  let component: OrgSelectComponent;
  let fixture: ComponentFixture<OrgSelectComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrgSelectComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Keycloak, useValue: mockKeycloak() },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(OrgSelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    flushSettings(httpMock);
  });

  afterEach(() => httpMock.verify());

  it('loads all organisations', () => {
    const req = httpMock.expectOne(`${environment.apiUrl}/org`);
    const orgs = [{ id: 'org-1', name: 'Org 1' }];
    req.flush(orgs);

    expect(component['orgs']).toEqual(orgs as any);
  });

  it('updates the selected org on change', () => {
    httpMock.expectOne(`${environment.apiUrl}/org`).flush([]);

    const selected = { id: 'org-1', name: 'Org 1' } as any;
    component.handleChange(selected);

    expect(component.org()).toBe(selected);
  });
});
