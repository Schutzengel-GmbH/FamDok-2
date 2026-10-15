import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import Keycloak from 'keycloak-js';

import { TabFamilienbetreuerComponent } from './tab-familienbetreuer.component';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { flushSettings } from 'src/app/testing/http-helpers';
import { buildUser } from 'src/app/testing/fixtures';
import { environment } from 'src/environments/environment';

describe('TabFamilienbetreuerComponent', () => {
  let fixture: ComponentFixture<TabFamilienbetreuerComponent>;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TabFamilienbetreuerComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Keycloak, useValue: mockKeycloak() },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TabFamilienbetreuerComponent);
    fixture.componentRef.setInput('selectedCase', {
      id: 'case-1',
      organisationId: 'org-1',
      responsibleUsers: [{ id: 'other' }],
    } as any);
    fixture.detectChanges();
    flushSettings(httpMock);
  });

  afterEach(() => httpMock.verify());

  it('loads the last handovers and embeds the handover component', () => {
    httpMock.expectOne((r) => r.url.includes('/case/handover/case-1')).flush([]);
    httpMock
      .expectOne(`${environment.apiUrl}/me`)
      .flush(buildUser({ id: 'me', organisationId: 'org-1' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-case-handover')).toBeTruthy();
  });
});
