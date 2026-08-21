import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import Keycloak from 'keycloak-js';

import { MenuComponent } from './menu.component';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { buildUser } from 'src/app/testing/fixtures';
import { Role } from '../../../../../shared/generated/prisma/enums';

describe('MenuComponent', () => {
  let fixture: ComponentFixture<MenuComponent>;
  let component: MenuComponent;
  let httpMock: HttpTestingController;
  let keycloak: Keycloak;

  // Each test gets a fresh TestBed (and therefore a fresh, un-cached MeService instance),
  // since MeService.getMe() shareReplay-caches its result per service instance and the
  // component subscribes to it once, synchronously, in its constructor.
  async function setup(role: Role) {
    keycloak = mockKeycloak();
    await TestBed.configureTestingModule({
      imports: [MenuComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Keycloak, useValue: keycloak },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MenuComponent);
    component = fixture.componentInstance;

    const meReq = httpMock.expectOne((r) => r.url.endsWith('/me'));
    meReq.flush(buildUser({ role }));
  }

  afterEach(() => httpMock.verify());

  it('shows the admin nav for an Admin user, sorted by priority', async () => {
    await setup(Role.Admin);

    expect(component.isAdmin()).toBeTrue();
    const labels = component.topLinks().map((l) => l.label);
    expect(labels).toEqual([
      'Benutzerverwaltung',
      'Statistik-Dashboard',
      'Alle Formulardaten',
      'Dashboard',
      'Familien',
      'Alle Formulare',
      'Dokumente',
    ]);
  });

  it('shows the controller nav (no user-admin link) for a Controller user', async () => {
    await setup(Role.Controller);

    expect(component.isController()).toBeTrue();
    expect(component.isAdmin()).toBeFalse();
    const labels = component.topLinks().map((l) => l.label);
    expect(labels).toEqual(['Statistik-Dashboard', 'Alle Formulardaten', 'Dokumente']);
  });

  it('shows the controller nav for an OrgController user too', async () => {
    await setup(Role.OrgController);

    expect(component.isOrgController()).toBeTrue();
    const labels = component.topLinks().map((l) => l.label);
    expect(labels).toEqual(['Statistik-Dashboard', 'Alle Formulardaten', 'Dokumente']);
  });

  it('shows the base nav with "Meine Eingaben" for a plain User', async () => {
    await setup(Role.User);

    expect(component.isCoordinator()).toBeFalse();
    const links = component.topLinks();
    expect(links.map((l) => l.label)).toEqual([
      'Dashboard',
      'Familien',
      'Meine Eingaben',
      'Alle Formulare',
      'Dokumente',
    ]);
    expect(links.find((l) => l.link === '/all-stats')?.label).toBe('Meine Eingaben');
  });

  it('shows the base nav with "Alle Formulardaten" for an OrgCoordinator', async () => {
    await setup(Role.OrgCoordinator);

    expect(component.isCoordinator()).toBeTrue();
    const links = component.topLinks();
    expect(links.find((l) => l.link === '/all-stats')?.label).toBe(
      'Alle Formulardaten',
    );
  });

  it('shows the base nav with "Alle Formulardaten" for a SubOrgCoordinator', async () => {
    await setup(Role.SubOrgCoordinator);

    expect(component.isCoordinator()).toBeTrue();
    const links = component.topLinks();
    expect(links.find((l) => l.link === '/all-stats')?.label).toBe(
      'Alle Formulardaten',
    );
  });

  it('always exposes a single "Einstellungen" bottom link', async () => {
    await setup(Role.User);

    expect(component.bottomLinks()).toEqual([
      { icon: 'bi-gear', label: 'Einstellungen', link: '/einstellungen' },
    ] as any);
  });

  it('logs out via keycloak', async () => {
    await setup(Role.User);

    component.logout();

    expect(keycloak.logout).toHaveBeenCalled();
  });

  it('renders a nav link for every top and bottom link', async () => {
    await setup(Role.Admin);
    fixture.detectChanges();

    const links = fixture.nativeElement.querySelectorAll('a.menu-link');
    // 7 top links + 1 bottom (Einstellungen) + 1 logout link
    expect(links.length).toBe(9);
  });
});
