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

import { ContactDocumentation } from './contact-documentation.page';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { flushSettings } from 'src/app/testing/http-helpers';
import { environment } from 'src/environments/environment';

describe('ContactDocumentation', () => {
  let component: ContactDocumentation;
  let fixture: ComponentFixture<ContactDocumentation>;
  let httpMock: HttpTestingController;

  function setup(caseId: string | null = 'case-1') {
    TestBed.configureTestingModule({
      imports: [ContactDocumentation],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Keycloak, useValue: mockKeycloak() },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(caseId ? { caseId } : {}) } },
        },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ContactDocumentation);
    component = fixture.componentInstance;
    flushSettings(httpMock);
  }

  afterEach(() => httpMock.verify());

  it('fetches the case for the caseId route param', () => {
    setup('case-1');

    const req = httpMock.expectOne(`${environment.apiUrl}/case/i/case-1`);
    expect(req.request.method).toBe('GET');
    const theCase = { id: 'case-1', family: { name: 'Musterfamilie' } };
    req.flush(theCase);

    expect(component.initialCase).toEqual(theCase as any);
  });

  it('does not fetch a case when there is no caseId route param', () => {
    setup(null);

    expect(component.initialCase).toBeUndefined();
    expect(httpMock.match(() => true).length).toBe(0);
  });

  it('passes the loaded case to app-edit-contact-documentation as a new, in-progress doc', () => {
    setup('case-1');
    httpMock
      .expectOne(`${environment.apiUrl}/case/i/case-1`)
      .flush({ id: 'case-1', family: { name: 'Musterfamilie' } });
    fixture.detectChanges();
    TestBed.tick();

    // isNew is true with no existing doc, so the child auto-creates a draft documentation.
    httpMock
      .expectOne(`${environment.apiUrl}/case/i/case-1/documentation`)
      .flush({ id: 'draft-1', caseId: 'case-1' });

    expect(
      fixture.nativeElement.querySelector('app-edit-contact-documentation'),
    ).toBeTruthy();
  });
});
