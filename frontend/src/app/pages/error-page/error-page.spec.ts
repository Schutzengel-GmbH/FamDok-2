import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { ErrorPage } from './error-page';

describe('ErrorPage', () => {
  let component: ErrorPage;
  let fixture: ComponentFixture<ErrorPage>;

  function setup(params: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [ErrorPage],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(params) } },
        },
      ],
    });

    fixture = TestBed.createComponent(ErrorPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('falls back to default text when no query params are given', () => {
    setup();

    expect(component.code).toBe('Fehler');
    expect(component.message).toBe('Ein unbekannter Fehler ist aufgetreten.');
  });

  it('reads code/title/message from the query params', () => {
    setup({ code: '403', title: 'Nicht erlaubt', message: 'Kein Zugriff' });

    expect(component.code).toBe('403');
    expect(component.title).toBe('Nicht erlaubt');
    expect(component.message).toBe('Kein Zugriff');
  });
});
