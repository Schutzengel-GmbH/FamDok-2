import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import Keycloak from 'keycloak-js';

import { TabFamilienbetreuerComponent } from './tab-familienbetreuer.component';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { flushSettings } from 'src/app/testing/http-helpers';
import { buildUser } from 'src/app/testing/fixtures';
import { environment } from 'src/environments/environment';

describe('TabFamilienbetreuerComponent', () => {
  let component: TabFamilienbetreuerComponent;
  let fixture: ComponentFixture<TabFamilienbetreuerComponent>;
  let httpMock: HttpTestingController;
  const me = buildUser({ id: 'me', organisationId: 'org-1' });

  function setup() {
    TestBed.configureTestingModule({
      imports: [TabFamilienbetreuerComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Keycloak, useValue: mockKeycloak() },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TabFamilienbetreuerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('selectedCase', {
      id: 'case-1',
      responsibleUsers: [{ id: 'me' }],
    } as any);

    // fixture.detectChanges() renders the template, whose AsyncPipe bindings (users$, and
    // the handovers signal's underlying toObservable effect) subscribe as a side effect - both
    // requests are always outstanding immediately afterwards.
    fixture.detectChanges();
    flushSettings(httpMock);
    httpMock.expectOne((r) => r.url.includes('/case/handover/case-1')).flush([]);
  }

  afterEach(() => httpMock.verify());

  it('loads org users other than the current user into the SelectUser input', () => {
    setup();

    httpMock.expectOne(`${environment.apiUrl}/me`).flush(me);
    httpMock
      .expectOne((r) => r.url.includes(`/user/org/${me.organisationId}`))
      .flush([{ id: 'other-user' }]);
    fixture.detectChanges();

    const selectUserEl = fixture.nativeElement.querySelector('app-select-user');
    expect(selectUserEl).toBeTruthy();
  });

  it('requires at least one responsible user when removing the last one without a replacement', () => {
    setup();
    httpMock.expectOne(`${environment.apiUrl}/me`).flush(me);
    httpMock.expectOne((r) => r.url.includes('/user/org/')).flush([]);

    component['removeMe'].set(true);

    expect(component.error()).toContain('Mindestens eine Fachkraft');
  });

  it('has no error when a replacement is chosen', () => {
    setup();
    httpMock.expectOne(`${environment.apiUrl}/me`).flush(me);
    httpMock.expectOne((r) => r.url.includes('/user/org/')).flush([]);

    component['removeMe'].set(true);
    component['user'].set(buildUser({ id: 'new-user' }) as any);

    expect(component.error()).toBe('');
  });

  it('handover is a no-op when readOnly', () => {
    setup();
    httpMock.expectOne(`${environment.apiUrl}/me`).flush(me);
    httpMock.expectOne((r) => r.url.includes('/user/org/')).flush([]);
    fixture.componentRef.setInput('readOnly', true);

    component.handover();

    expect(httpMock.match(`${environment.apiUrl}/me`).length).toBe(0);
  });

  it('handover posts the change and emits changes on success', () => {
    setup();
    httpMock.expectOne(`${environment.apiUrl}/me`).flush(me);
    httpMock.expectOne((r) => r.url.includes('/user/org/')).flush([]);
    let changed: unknown;
    component.changes.subscribe((c) => (changed = c));
    component['removeMe'].set(true);

    component.handover();

    // meService.getMe() caches (shareReplay), so this second call inside handover() replays
    // the cached user without a new HTTP request - only the handover POST goes out.
    const req = httpMock.expectOne(`${environment.apiUrl}/case/handover`);
    expect(req.request.body.removedIds).toEqual(['me']);
    req.flush({});

    expect(changed).toEqual({ userRemoved: true });
  });
});
