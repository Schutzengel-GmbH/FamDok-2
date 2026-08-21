import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import Keycloak from 'keycloak-js';

import { MeComponent } from './me';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { buildUser } from 'src/app/testing/fixtures';
import { environment } from 'src/environments/environment';

describe('MeComponent', () => {
  let component: MeComponent;
  let fixture: ComponentFixture<MeComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Keycloak, useValue: mockKeycloak() },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MeComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => httpMock.verify());

  it('loads and displays the current user', () => {
    fixture.detectChanges();

    const user = buildUser({ firstName: 'Jane' });
    httpMock.expectOne(`${environment.apiUrl}/me`).flush(user);

    expect(component['user']).toEqual(user);
  });
});
