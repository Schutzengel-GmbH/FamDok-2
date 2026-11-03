import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { FamilyService } from './family.service';
import { environment } from 'src/environments/environment';

describe('FamilyService', () => {
  let service: FamilyService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FamilyService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getFamily GETs a single family by id', () => {
    service.getFamily('family-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/family/i/family-1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('getHealthData extracts the healthData field from the child', () => {
    let result: unknown;
    service.getHealthData('family-1', 'child-1').subscribe((r) => (result = r));

    const healthData = [{ date: new Date(), weightKg: 5 }];
    httpMock
      .expectOne(`${environment.apiUrl}/family/i/family-1/children/child-1`)
      .flush({ id: 'child-1', healthData });

    expect(result).toEqual(healthData as any);
  });

  it('updateFamily PUTs the update', () => {
    service.updateFamily('family-1', { name: 'Neu' } as any).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/family/i/family-1`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('deleteFamily DELETEs by id', () => {
    service.deleteFamily('family-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/family/i/family-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});
