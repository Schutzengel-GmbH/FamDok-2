import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import Keycloak from 'keycloak-js';

import { AllFormData } from './all-caseform-data.page';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { environment } from 'src/environments/environment';

describe('AllFormData', () => {
  let component: AllFormData;
  let fixture: ComponentFixture<AllFormData>;
  let httpMock: HttpTestingController;

  function setup(formId = 'gform-1') {
    TestBed.configureTestingModule({
      imports: [AllFormData],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Keycloak, useValue: mockKeycloak() },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ formId }) } },
        },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AllFormData);
    component = fixture.componentInstance;
  }

  afterEach(() => httpMock.verify());

  it('reads the formId from the route and fetches the general form definition', () => {
    setup('gform-1');

    const req = httpMock.expectOne(
      `${environment.apiUrl}/general-form/definitions/i/gform-1`,
    );
    expect(req.request.method).toBe('GET');
    const definition = { id: 'gform-1', name: 'Umfrage', questions: [] };
    req.flush(definition);

    expect(component.form).toEqual(definition as any);
  });

  it('renders app-allgeneral-data once the form has loaded', () => {
    setup('gform-1');
    httpMock
      .expectOne(`${environment.apiUrl}/general-form/definitions/i/gform-1`)
      .flush({ id: 'gform-1', name: 'Umfrage', questions: [] });
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiUrl}/me`).flush({ role: 'Admin' });
    httpMock.expectOne(`${environment.apiUrl}/org`).flush([]);
    httpMock
      .match((r) => r.url.includes('/general-form/responses'))
      .forEach((r) => r.flush([]));

    expect(
      fixture.nativeElement.querySelector('app-allgeneral-data'),
    ).toBeTruthy();
  });
});
