import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { MeService } from 'src/app/services/me.service';
import { sortByNumProperty } from 'src/app/util/generalUtils';
import Keycloak from 'keycloak-js';
import { Role } from '../../../../../shared/generated/prisma/enums';

type LinkData = {
  priority: number;
  icon: string;
  label: string;
  link: string;
};

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],
})
export class MenuComponent {
  private meService = inject(MeService);
  private keycloak = inject(Keycloak);
  private activatedRoute = inject(ActivatedRoute);

  isController = signal(false);
  isAdmin = signal(false);
  // OrgController is "Controller, but limited to their own org" - same nav (stats/all-stats/
  // documents), not the case-working nav Users/Coordinators get.
  isOrgController = signal(false);
  // OrgCoordinator/SubOrgCoordinator see all of their org's/suborg's data on the all-stats
  // page (not just their own), so it needs the same "Alle Formulardaten" label Controller/
  // OrgController get, not "Meine Eingaben".
  isCoordinator = signal(false);

  constructor() {
    this.meService.getMe().subscribe((user) => {
      this.isAdmin.set(user.role === Role.Admin);
      this.isController.set(user.role === Role.Controller);
      this.isOrgController.set(user.role === Role.OrgController);
      this.isCoordinator.set(
        user.role === Role.OrgCoordinator || user.role === Role.SubOrgCoordinator,
      );
    });
  }

  logout() {
    this.keycloak.logout();
  }

  topLinks = computed(() => {
    const adminLinks: LinkData[] = [
      {
        priority: 0,
        icon: '',
        label: 'Benutzerverwaltung',
        link: '/user-admin',
      },
      {
        priority: 0,
        icon: 'bi-clipboard-data',
        label: 'Statistik-Dashboard',
        link: '/stats',
      },
      {
        priority: 1,
        icon: 'bi-speedometer2',
        label: 'Dashboard',
        link: '/dashboard',
      },
      {
        priority: 0,
        icon: 'bi-clipboard-data',
        label: 'Alle Formulardaten',
        link: '/all-stats',
      },
      { priority: 2, icon: 'bi-people', label: 'Familien', link: '/familien' },
      {
        priority: 3,
        icon: 'bi-journal-text',
        label: 'Alle Formulare',
        link: '/formulare',
      },
      {
        priority: 4,
        icon: 'bi-folder2-open',
        label: 'Dokumente',
        link: '/dokumente',
      },

      /* {
        priority: 9001,
        icon: 'bi-three-dots',
        label: 'Sonstiges',
        link: '/sonstiges',
      }, */
    ];
    const controllerLinks: LinkData[] = [
      {
        priority: 0,
        icon: 'bi-clipboard-data',
        label: 'Statistik-Dashboard',
        link: '/stats',
      },
      {
        priority: 0,
        icon: 'bi-clipboard-data',
        label: 'Alle Formulardaten',
        link: '/all-stats',
      },
      {
        priority: 1,
        icon: 'bi-folder2-open',
        label: 'Dokumente',
        link: '/dokumente',
      },
      /* {
        priority: 9001,
        icon: 'bi-three-dots',
        label: 'Sonstiges',
        link: '/sonstiges',
      }, */
    ];
    const baseLinks: LinkData[] = [
      {
        priority: 1,
        icon: 'bi-speedometer2',
        label: 'Dashboard',
        link: '/dashboard',
      },
      { priority: 2, icon: 'bi-people', label: 'Familien', link: '/familien' },
      {
        priority: 3,
        icon: 'bi-clipboard-data',
        label: this.isCoordinator() ? 'Alle Formulardaten' : 'Meine Eingaben',
        link: '/all-stats',
      },
      {
        priority: 4,
        icon: 'bi-journal-text',
        label: 'Alle Formulare',
        link: '/formulare',
      },
      {
        priority: 5,
        icon: 'bi-folder2-open',
        label: 'Dokumente',
        link: '/dokumente',
      },
      /*  {
        priority: 9001,
        icon: 'bi-three-dots',
        label: 'Sonstiges',
        link: '/sonstiges',
      }, */
    ];
    if (this.isAdmin()) return adminLinks.sort(sortByNumProperty('priority'));
    if (this.isController() || this.isOrgController())
      return controllerLinks.sort(sortByNumProperty('priority'));
    return baseLinks.sort(sortByNumProperty('priority'));
  });

  bottomLinks = computed(
    () =>
      [
        {
          icon: 'bi-gear',
          label: 'Einstellungen',
          link: '/einstellungen',
        },
        /* {
          icon: 'bi-chat-dots',
          label: 'Nachrichten',
          link: '/nachrichten',
        }, */
      ] as LinkData[],
  );
}
