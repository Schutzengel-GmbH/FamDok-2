import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';

import { TabFreieDokumentationComponent } from './tab-freie-dokumentation.component';
import { WarningType, FormType } from '../../../../../../shared/consts';

describe('TabFreieDokumentationComponent', () => {
  let component: TabFreieDokumentationComponent;
  let fixture: ComponentFixture<TabFreieDokumentationComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabFreieDokumentationComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TabFreieDokumentationComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('selectedCase', { id: 'case-1' } as any);
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url.includes('/warnings')).flush([]);
    httpMock.expectOne((r) => r.url.includes('/documentation/latest')).flush([]);
  });

  afterEach(() => httpMock.verify());

  it('addContact navigates to the contact documentation editor', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    component.addContact();

    expect(router.navigate).toHaveBeenCalledWith(['contact-documentation', 'case-1']);
  });

  it('addContact is a no-op when readOnly', () => {
    fixture.componentRef.setInput('readOnly', true);
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    component.addContact();

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('hasWarning is false with no matching warnings', () => {
    expect(component.hasWarning('doc-1')).toBeFalse();
  });
});

describe('TabFreieDokumentationComponent with an unfinished contact doc warning', () => {
  let component: TabFreieDokumentationComponent;
  let fixture: ComponentFixture<TabFreieDokumentationComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabFreieDokumentationComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TabFreieDokumentationComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('selectedCase', { id: 'case-1' } as any);
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url.includes('/warnings')).flush([
      {
        type: WarningType.UNFINISHED_FORM,
        data: { caseId: 'case-1', formType: FormType.CONTACT_DOC, responseId: 'doc-1' },
      },
    ]);
    httpMock.expectOne((r) => r.url.includes('/documentation/latest')).flush([]);
  });

  afterEach(() => httpMock.verify());

  it('hasWarning is true for the flagged doc', () => {
    expect(component.hasWarning('doc-1')).toBeTrue();
    expect(component.hasWarning('doc-2')).toBeFalse();
  });
});
