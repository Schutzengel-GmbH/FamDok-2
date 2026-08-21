import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';

import { TabSonstigeFormulareComponent } from './tab-formulare.component';

describe('TabSonstigeFormulareComponent', () => {
  let component: TabSonstigeFormulareComponent;
  let fixture: ComponentFixture<TabSonstigeFormulareComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabSonstigeFormulareComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TabSonstigeFormulareComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('selectedCase', { id: 'case-1' } as any);
    // Not calling fixture.detectChanges(): forms$ is cold/unshared, so avoid a competing
    // subscription from the template's AsyncPipe.
  });

  afterEach(() => httpMock.verify());

  it('sorts forms alphabetically by name', (done) => {
    component.forms$.subscribe((forms) => {
      expect(forms.map((f) => f.name)).toEqual(['Alpha', 'Beta']);
      done();
    });

    httpMock.expectOne((r) => r.url.includes('/case-form-definition')).flush([
      { id: 'form-b', name: 'Beta' },
      { id: 'form-a', name: 'Alpha' },
    ]);
  });

  it('gotoForm navigates to the response for the case', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    component.gotoForm('form-a');

    expect(router.navigate).toHaveBeenCalledWith(['responses', 'form-a'], {
      queryParams: { caseId: 'case-1' },
    });
  });

  it('gotoForm is a no-op when readOnly', () => {
    fixture.componentRef.setInput('readOnly', true);
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    component.gotoForm('form-a');

    expect(router.navigate).not.toHaveBeenCalled();
  });
});
