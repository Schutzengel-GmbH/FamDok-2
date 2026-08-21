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

import { AllCaseFormData } from './all-caseform-data.page';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { environment } from 'src/environments/environment';

describe('AllCaseFormData', () => {
  let component: AllCaseFormData;
  let fixture: ComponentFixture<AllCaseFormData>;
  let httpMock: HttpTestingController;

  function setup(formId = 'form-1') {
    TestBed.configureTestingModule({
      imports: [AllCaseFormData],
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
    fixture = TestBed.createComponent(AllCaseFormData);
    component = fixture.componentInstance;
  }

  afterEach(() => httpMock.verify());

  it('reads the formId from the route and fetches the case form definition', () => {
    setup('form-1');

    const req = httpMock.expectOne(
      `${environment.apiUrl}/case-form-definition/i/form-1`,
    );
    expect(req.request.method).toBe('GET');
    const definition = { id: 'form-1', name: 'Erstgespräch', questions: [] };
    req.flush(definition);

    expect(component.form).toEqual(definition as any);
  });

  it('renders app-all-data once the form has loaded', () => {
    setup('form-1');
    httpMock
      .expectOne(`${environment.apiUrl}/case-form-definition/i/form-1`)
      .flush({ id: 'form-1', name: 'Erstgespräch', questions: [] });
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiUrl}/me`).flush({ role: 'Admin' });
    httpMock.expectOne(`${environment.apiUrl}/org`).flush([]);
    httpMock
      .match((r) => r.url.includes('/case-form-response'))
      .forEach((r) => r.flush([]));

    expect(fixture.nativeElement.querySelector('app-all-data')).toBeTruthy();
  });
});
