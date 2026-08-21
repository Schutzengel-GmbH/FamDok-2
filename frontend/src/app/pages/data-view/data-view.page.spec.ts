import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { DataViewPage } from './data-view.page';

describe('DataViewPage', () => {
  let component: DataViewPage;
  let fixture: ComponentFixture<DataViewPage>;
  let httpMock: HttpTestingController;
  let router: Router;

  const generalForms = [{ id: 'g1', name: 'Zufriedenheit' }];
  const caseForms = [{ id: 'c1', name: 'Aufnahme' }];

  function setup() {
    TestBed.configureTestingModule({
      imports: [DataViewPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(DataViewPage);
    component = fixture.componentInstance;

    httpMock
      .expectOne((r) => r.url.includes('/general-form/definitions'))
      .flush(generalForms);
    httpMock
      .expectOne((r) => r.url.includes('/case-form-definition'))
      .flush(caseForms);
  }

  afterEach(() => httpMock.verify());

  it('loads general and case forms and combines them with the static contact-documentation entry', () => {
    setup();

    const names = component.filteredForms().map((f) => f.name);
    expect(names).toEqual([
      'Aufnahme',
      'Fallkontaktdokumentation',
      'Zufriedenheit',
    ]);
  });

  it('filters forms case- and accent-insensitively by name', () => {
    setup();

    component.filter.set('zufriedenheit');

    expect(component.filteredForms().map((f) => f.name)).toEqual([
      'Zufriedenheit',
    ]);
  });

  it('clearFilter resets the filter to an empty string', () => {
    setup();
    component.filter.set('aufnahme');

    component.clearFilter();

    expect(component.filter()).toBe('');
  });

  describe('clickForm', () => {
    it('navigates to the contact-documentation table for the static entry', () => {
      setup();
      spyOn(router, 'navigate');

      component.clickForm('CONTACT_DOCUMENTATION', 'caseForm');

      expect(router.navigate).toHaveBeenCalledWith([
        'contact-documentation-table',
      ]);
    });

    it('navigates to all-caseform-data for a dynamic case form', () => {
      setup();
      spyOn(router, 'navigate');

      component.clickForm('c1', 'caseForm');

      expect(router.navigate).toHaveBeenCalledWith(['all-caseform-data', 'c1']);
    });

    it('navigates to all-form-data for a dynamic general form', () => {
      setup();
      spyOn(router, 'navigate');

      component.clickForm('g1', 'generalForm');

      expect(router.navigate).toHaveBeenCalledWith(['all-form-data', 'g1']);
    });
  });
});
