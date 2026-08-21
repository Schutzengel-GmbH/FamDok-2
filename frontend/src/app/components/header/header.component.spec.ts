import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import Keycloak from 'keycloak-js';

import { HeaderComponent } from './header.component';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { ThemeService } from '../../services/theme.service';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;
  let keycloak: Keycloak;

  function setup(authenticated: boolean) {
    keycloak = mockKeycloak({ authenticated });
    TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [provideRouter([]), { provide: Keycloak, useValue: keycloak }],
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

  it('logout() delegates to Keycloak.logout', () => {
    setup(true);
    component.logout();
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
