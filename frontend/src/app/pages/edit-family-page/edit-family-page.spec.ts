import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Location } from '@angular/common';
import Keycloak from 'keycloak-js';

import { EditFamilyPage } from './edit-family-page';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { flushSettings } from 'src/app/testing/http-helpers';

describe('EditFamilyPage', () => {
  let component: EditFamilyPage;
  let fixture: ComponentFixture<EditFamilyPage>;
  let httpMock: HttpTestingController;

  function setup(params: Record<string, string>, queryParams: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [EditFamilyPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Keycloak, useValue: mockKeycloak() },
        { provide: Location, useValue: jasmine.createSpyObj('Location', ['back']) },
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
    fixture = TestBed.createComponent(EditFamilyPage);
    component = fixture.componentInstance;
    fixture.detectChanges(false);
    flushSettings(httpMock);
    httpMock.match((r) => r.url.includes('/family/i/')).forEach((r) =>
      r.flush({ adress: {}, additionalPhones: [], caregiver: [], children: [] }),
    );
  }

  afterEach(() => httpMock.verify());

  it('reads the family id from the route', () => {
    setup({ id: 'family-1' });

    expect(component.id).toBe('family-1');
    expect(component.readOnly).toBeFalse();
  });

  it('is read-only when the readonly query param is true', () => {
    setup({ id: 'family-1' }, { readonly: 'true' });

    expect(component.readOnly).toBeTrue();
  });
});
