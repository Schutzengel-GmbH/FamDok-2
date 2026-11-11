import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import Keycloak from 'keycloak-js';

import { HeaderComponent } from './header.component';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { ThemeService } from '../../services/theme.service';
import { signal } from '@angular/core';
import { KeySessionService } from '../../services/key-session.service';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;
  let keycloak: Keycloak;
  let keys: { state: ReturnType<typeof signal<string>>; lock: jasmine.Spy; ensureLoaded: jasmine.Spy };

  function setup(authenticated: boolean, keyState = 'notNeeded') {
    keycloak = mockKeycloak({ authenticated });
    keys = {
      state: signal(keyState),
      lock: jasmine.createSpy('lock'),
      ensureLoaded: jasmine.createSpy('ensureLoaded').and.resolveTo(),
    };
    TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter([]),
        { provide: Keycloak, useValue: keycloak },
        { provide: KeySessionService, useValue: keys },
      ],
    });

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('reflects an authenticated Keycloak session', () => {
    setup(true);
    expect(component['authenticated']).toBeTrue();
  });

  it('reflects an unauthenticated Keycloak session', () => {
    setup(false);
    expect(component['authenticated']).toBeFalse();
  });

  it('login() delegates to Keycloak.login', () => {
    setup(false);
    component.login();
    expect(keycloak.login).toHaveBeenCalled();
  });

  it('shows a lock button while unlocked that locks the keys', () => {
    setup(true, 'unlocked');
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.bi-unlock').parentElement;
    button.click();
    expect(keys.lock).toHaveBeenCalled();
  });

  it('links to the encryption page while locked', () => {
    setup(true, 'locked');
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.bi-lock').parentElement;
    expect(link.getAttribute('href')).toBe('/verschluesselung');
  });

  it('logout() discards the keys and delegates to Keycloak.logout', () => {
    setup(true);
    component.logout();
    expect(keys.lock).toHaveBeenCalled();
    expect(keycloak.logout).toHaveBeenCalled();
  });

  it('toggleTheme() delegates to ThemeService.toggle', () => {
    setup(true);
    const themeService = TestBed.inject(ThemeService);
    const toggleSpy = spyOn(themeService, 'toggle');

    component.toggleTheme();

    expect(toggleSpy).toHaveBeenCalled();
  });

  it('login/logout button click wires through to the corresponding Keycloak call', () => {
    setup(false);
    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      'button.btn-outline-primary',
    );
    button.click();

    expect(keycloak.login).toHaveBeenCalled();
  });
});
