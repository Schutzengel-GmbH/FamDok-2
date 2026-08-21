import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { CaseFormsPage } from './caseForms';

describe('CaseFormsPage', () => {
  let component: CaseFormsPage;
  let fixture: ComponentFixture<CaseFormsPage>;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CaseFormsPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CaseFormsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url.includes('/settings')).flush([]);
    httpMock
      .expectOne((r) => r.url.includes('/case-form-definition'))
      .flush([{ id: 'form-1', name: 'Aufnahme' }, { id: 'form-2', name: 'Abschluss' }]);
    httpMock
      .expectOne((r) => r.url.includes('/general-form/definitions'))
      .flush([{ id: 'gform-1', name: 'Feedback' }]);
  });

  afterEach(() => httpMock.verify());

  it('loads case forms and general forms', () => {
    expect(component['caseForms'].length).toBe(2);
    expect(component['generalForms'].length).toBe(1);
  });

  it('filters forms by search term, accent- and case-insensitively', () => {
    component['searchTerm'] = 'AUFNAHME';

    expect(component['filteredCaseForms']).toEqual([
      jasmine.objectContaining({ name: 'Aufnahme' }),
    ]);
  });

  it('navigates to the health-data route for the special HEALTH_DATA form', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    component.selectFamForm('HEALTH_DATA');

    expect(router.navigate).toHaveBeenCalledWith(['gesundheits-daten']);
  });

  it('navigates to the response route for a regular case form', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    component.selectFamForm('form-1');

    expect(router.navigate).toHaveBeenCalledWith(['responses', 'form-1']);
  });

  it('navigates to the contact-documentation route for the special CONTACT_DOCUMENTATION form', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    component.selectFamForm('CONTACT_DOCUMENTATION');

    expect(router.navigate).toHaveBeenCalledWith(['contact-documentation']);
  });

  it('navigates to the general-responses route with the definitionId as a query param', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    component.selectGenForm('gform-1');

    expect(router.navigate).toHaveBeenCalledWith(['general-responses'], {
      queryParams: { definitionId: 'gform-1' },
    });
  });

  it('returns every case/general/special form when the search term is empty', () => {
    expect(component['filteredCaseForms'].length).toBe(2);
    expect(component['filteredGeneralForms'].length).toBe(1);
    expect(component['filteredCaseSpecialForms'].length).toBe(2);
  });

  it('filters general forms by search term, accent- and case-insensitively', () => {
    component['searchTerm'] = 'feedback';

    expect(component['filteredGeneralForms']).toEqual([
      jasmine.objectContaining({ name: 'Feedback' }),
    ]);
  });

  it('filters special case forms by search term', () => {
    component['searchTerm'] = 'gesundheit';

    expect(component['filteredCaseSpecialForms']).toEqual([
      jasmine.objectContaining({ id: 'HEALTH_DATA' }),
    ]);
  });

  it('setFilter updates the active filter', () => {
    component['setFilter']('case');

    expect(component['activeFilter']).toBe('case');
  });

  it('clearSearch resets the search term', () => {
    component['searchTerm'] = 'aufnahme';

    component['clearSearch']();

    expect(component['searchTerm']).toBe('');
  });
});
