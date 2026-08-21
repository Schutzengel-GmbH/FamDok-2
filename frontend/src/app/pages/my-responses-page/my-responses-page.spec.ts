import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import Keycloak from 'keycloak-js';

import { MyResponsesPage } from './my-responses-page';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { buildUser } from 'src/app/testing/fixtures';
import { environment } from 'src/environments/environment';

describe('MyResponsesPage', () => {
  let component: MyResponsesPage;
  let fixture: ComponentFixture<MyResponsesPage>;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MyResponsesPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Keycloak, useValue: mockKeycloak() },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyResponsesPage);
    component = fixture.componentInstance;
  });

  afterEach(() => httpMock.verify());

  it("loads the current user's own responses", () => {
    fixture.detectChanges();

    const user = buildUser();
    httpMock.expectOne(`${environment.apiUrl}/me`).flush(user);

    const responses = [{ id: 'resp-1', caseFormId: 'form-1' }];
    httpMock.expectOne((r) => r.url.includes('/case-form-response')).flush(responses);

    expect(component['responses']).toEqual(responses as any);
  });

  it('navigates to the response detail page', () => {
    fixture.detectChanges();
    httpMock.expectOne(`${environment.apiUrl}/me`).flush(buildUser());
    httpMock.expectOne((r) => r.url.includes('/case-form-response')).flush([]);

    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    component.nav('resp-1', 'form-1');

    expect(router.navigate).toHaveBeenCalledWith(['responses', 'form-1'], {
      queryParams: { id: 'resp-1' },
    });
  });
});
