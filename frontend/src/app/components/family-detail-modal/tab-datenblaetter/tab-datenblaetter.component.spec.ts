import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';

import { TabDatenblaetterComponent } from './tab-datenblaetter.component';
import { WarningType } from '../../../../../../shared/consts';

describe('TabDatenblaetterComponent', () => {
  let component: TabDatenblaetterComponent;
  let fixture: ComponentFixture<TabDatenblaetterComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabDatenblaetterComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TabDatenblaetterComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('selectedCase', { id: 'case-1' } as any);
    // Deliberately not calling fixture.detectChanges(): forms$ is a cold, non-shared
    // observable, so letting the template's AsyncPipe subscribe here as well as the test
    // subscribing explicitly below would fire every request twice.
  });

  afterEach(() => httpMock.verify());

  it('excludes the closing_doc form, sorts alphabetically, and flags unfinished forms', (done) => {
    component.forms$.subscribe((forms) => {
      expect(forms.map((f) => f.id)).toEqual(['form-a', 'form-b']);
      expect(forms.find((f) => f.id === 'form-a')?.hasWarning).toBeTrue();
      expect(forms.find((f) => f.id === 'form-b')?.hasWarning).toBeFalse();
      done();
    });

    httpMock
      .expectOne((r) => r.url.includes('/settings'))
      .flush([{ name: 'closing_doc', value: 'form-closing' }]);
    httpMock.expectOne((r) => r.url.includes('/case-form-definition')).flush([
      { id: 'form-closing', name: 'Abschluss' },
      { id: 'form-b', name: 'Beta' },
      { id: 'form-a', name: 'Alpha' },
    ]);
    httpMock.expectOne((r) => r.url.includes('/warnings')).flush([
      {
        type: WarningType.UNFINISHED_FORM,
        data: { caseId: 'case-1', caseFormId: 'form-a' },
      },
    ]);
  });

  it('gotoForm navigates to the response with the case id', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    component.gotoForm('form-a');

    expect(router.navigate).toHaveBeenCalledWith(['responses', 'form-a'], {
      queryParams: { caseId: 'case-1' },
    });
  });

  it('gotoForm includes readonly when the tab is read-only', () => {
    fixture.componentRef.setInput('readOnly', true);
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    component.gotoForm('form-a');

    expect(router.navigate).toHaveBeenCalledWith(['responses', 'form-a'], {
      queryParams: { caseId: 'case-1', readonly: true },
    });
  });
});
