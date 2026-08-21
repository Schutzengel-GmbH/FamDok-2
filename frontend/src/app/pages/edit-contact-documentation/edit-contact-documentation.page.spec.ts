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

import { EditContactDocumentationPage } from './edit-contact-documentation.page';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { flushSettings } from 'src/app/testing/http-helpers';
import { environment } from 'src/environments/environment';

describe('EditContactDocumentationPage', () => {
  let component: EditContactDocumentationPage;
  let fixture: ComponentFixture<EditContactDocumentationPage>;
  let httpMock: HttpTestingController;

  function setup(queryParams: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [EditContactDocumentationPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Keycloak, useValue: mockKeycloak() },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ caseId: 'case-1', docId: 'doc-1' }),
              queryParamMap: convertToParamMap(queryParams),
            },
          },
        },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EditContactDocumentationPage);
    component = fixture.componentInstance;
    // CaseService is injected on the page, whose constructor fires a /settings GET through
    // SettingsService regardless of detectChanges().
    flushSettings(httpMock);
  }

  afterEach(() => httpMock.verify());

  it('reads caseId/docId from the route and readOnly from the query params', () => {
    setup({ readonly: 'true' });

    expect(component.caseId).toBe('case-1');
    expect(component.docId).toBe('doc-1');
    expect(component.readOnly).toBeTrue();
  });

  it('defaults readOnly to false when the query param is absent', () => {
    setup();

    expect(component.readOnly).toBeFalse();
  });

  it('fetches the documentation and the case, and renders the editor with both', () => {
    setup();
    fixture.detectChanges();

    const doc = { id: 'doc-1', caseId: 'case-1', zusammenfassung: 'Alles gut' };
    const theCase = { id: 'case-1', family: { name: 'Musterfamilie' } };

    httpMock
      .expectOne(
        `${environment.apiUrl}/case/i/case-1/documentation/i/doc-1`,
      )
      .flush(doc);
    httpMock.expectOne(`${environment.apiUrl}/case/i/case-1`).flush(theCase);
    fixture.detectChanges();

    const editor = fixture.nativeElement.querySelector(
      'app-edit-contact-documentation',
    );
    expect(editor).toBeTruthy();

    // The nested app-select-case renders unconditionally and always fetches "my cases".
    httpMock.match((r) => r.url.includes('/case/my')).forEach((r) => r.flush([]));
  });
});
