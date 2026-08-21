import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import Keycloak from 'keycloak-js';

import { AllContactData } from './all-contact-documentation.page';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { flushSettings } from 'src/app/testing/http-helpers';
import { buildUser } from 'src/app/testing/fixtures';
import { environment } from 'src/environments/environment';
import { Role } from '../../../../../shared/generated/prisma/enums';

describe('AllContactData', () => {
  let component: AllContactData;
  let fixture: ComponentFixture<AllContactData>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AllContactData],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Keycloak, useValue: mockKeycloak() },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AllContactData);
    component = fixture.componentInstance;
  });

  afterEach(() => httpMock.verify());

  it('renders the contact documentation table', () => {
    fixture.detectChanges();

    flushSettings(httpMock);
    httpMock
      .expectOne(`${environment.apiUrl}/me`)
      .flush(buildUser({ role: Role.User, id: 'me' }));
    httpMock.expectOne(`${environment.apiUrl}/org`).flush([]);
    httpMock.expectOne((r) => r.url.includes('/documentation/')).flush([]);

    expect(
      fixture.nativeElement.querySelector('app-contact-documentation-table'),
    ).toBeTruthy();
  });
});
