import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import Keycloak from 'keycloak-js';

import { SelectCaseComponent } from './select-case';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { flushSettings } from 'src/app/testing/http-helpers';

describe('SelectCase', () => {
  let component: SelectCaseComponent;
  let fixture: ComponentFixture<SelectCaseComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectCaseComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Keycloak, useValue: mockKeycloak() },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SelectCaseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    flushSettings(httpMock);
  });

  afterEach(() => httpMock.verify());

  it('loads the user\'s own cases', () => {
    const req = httpMock.match((r) => r.url.includes('/case/my'));
    expect(req.length).toBe(1);
    const cases = [{ id: 'case-1' }];
    req[0].flush(cases);

    expect(component['cases']).toEqual(cases as any);
  });
});
