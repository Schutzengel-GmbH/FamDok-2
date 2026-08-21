import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { convertToParamMap } from '@angular/router';
import Keycloak from 'keycloak-js';

import { HealthDataInputComponent } from './health-data-input.component';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { flushSettings } from 'src/app/testing/http-helpers';
import { environment } from 'src/environments/environment';

describe('HealthDataInputComponent', () => {
  let component: HealthDataInputComponent;
  let fixture: ComponentFixture<HealthDataInputComponent>;
  let httpMock: HttpTestingController;

  function setup(paramMap: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [HealthDataInputComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Keycloak, useValue: mockKeycloak() },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(paramMap) } },
        },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HealthDataInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    flushSettings(httpMock);
    // The nested app-select-case renders unconditionally and always fetches "my cases".
    httpMock.match((r) => r.url.includes('/case/my')).forEach((r) => r.flush([]));
  }

  afterEach(() => httpMock.verify());

  it('does not fetch a case when no caseId route param is present', () => {
    setup();

    expect(component.caseId).toBeNull();
    expect(component.case).toBeUndefined();
  });

  it('fetches the case when a caseId route param is present', () => {
    setup({ caseId: 'case-1' });

    expect(component.caseId).toBe('case-1');
    const req = httpMock.expectOne(`${environment.apiUrl}/case/i/case-1`);
    const theCase = { id: 'case-1', family: { id: 'family-1' } };
    req.flush(theCase);

    expect(component.case).toEqual(theCase as any);
  });

  describe('age', () => {
    it('returns 0 when no child is given', () => {
      setup();
      expect(component.age(undefined)).toBe(0);
    });

    it('delegates to ageString when a child is given', () => {
      setup();
      const child = { dateOfBirth: new Date(2020, 0, 1) } as any;
      expect(component.age(child)).toContain('Jahre');
    });
  });

  it('onDateInput stores the selected date', () => {
    setup();
    const date = { year: 2026, month: 3, day: 1 } as any;

    component.onDateInput(date);

    expect(component.dateInput).toBe(date);
  });

  it('does not submit when required fields are missing', () => {
    setup();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    component.add();

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('saves the health data point and navigates home on success', () => {
    setup();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    component.case = { family: { id: 'family-1' } } as any;
    component.child = { id: 'child-1', healthData: [] } as any;
    component.weight = 12;
    component.dateInput = { year: 2026, month: 3, day: 1 } as any;

    component.add();

    const req = httpMock.expectOne((r) => r.url.includes('/family/i/family-1'));
    req.flush({ name: 'Muster' });

    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('treats a missing existing healthData array as empty when saving', () => {
    setup();
    component.case = { family: { id: 'family-1' } } as any;
    component.child = { id: 'child-1', healthData: undefined } as any;
    component.weight = 12;
    component.dateInput = { year: 2026, month: 3, day: 1 } as any;

    component.add();

    const req = httpMock.expectOne((r) => r.url.includes('/family/i/family-1'));
    const update = req.request.body.children.update.data.healthData;
    expect(update.length).toBe(1);
    req.flush({ name: 'Muster' });
  });
});
