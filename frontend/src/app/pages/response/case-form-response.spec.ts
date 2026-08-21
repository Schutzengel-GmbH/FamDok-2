import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import Keycloak from 'keycloak-js';

import { CaseFormResponsePage } from './case-form-response';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { flushSettings } from 'src/app/testing/http-helpers';

describe('CaseFormResponsePage', () => {
  let component: CaseFormResponsePage;
  let fixture: ComponentFixture<CaseFormResponsePage>;
  let httpMock: HttpTestingController;

  function setup(params: Record<string, string>, queryParams: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [CaseFormResponsePage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Keycloak, useValue: mockKeycloak() },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap(params),
              queryParamMap: convertToParamMap(queryParams),
            },
          },
        },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CaseFormResponsePage);
    component = fixture.componentInstance;
  }

  afterEach(() => httpMock.verify());

  it('reads ids and readonly flag from the route', () => {
    setup(
      { caseFormId: 'form-1' },
      { id: 'resp-1', caseId: 'case-1', readonly: 'true' },
    );
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.includes('/case-form-definition/i/form-1')).flush({});
    flushSettings(httpMock);
    httpMock.expectOne((r) => r.url.includes('/case/i/case-1')).flush({});
    httpMock.expectOne((r) => r.url.includes('/case-form-response/i/resp-1')).flush({ case: {} });

    expect(component.caseFormId).toBe('form-1');
    expect(component.responseId).toBe('resp-1');
    expect(component.caseId).toBe('case-1');
    expect(component.readOnly).toBeTrue();
  });

  it('loads the case form definition', () => {
    setup({ caseFormId: 'form-1' });
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.includes('/case-form-definition/i/form-1'));
    req.flush({ id: 'form-1', name: 'Intake', type: 'multiple' });
    flushSettings(httpMock);

    expect(component.caseForm()).toEqual(
      jasmine.objectContaining({ id: 'form-1', name: 'Intake' }),
    );
  });
});
