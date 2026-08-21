import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../services/theme.service';
import Keycloak from 'keycloak-js';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent {
  private keycloak = inject(Keycloak);
  private themeSvc = inject(ThemeService);

  protected authenticated = this.keycloak.authenticated;

  theme: 'light' | 'dark' = 'light';

  constructor() {}

  toggleTheme() {
    this.themeSvc.toggle();
  }

  logout() {
    this.keycloak.logout();
  }

  login() {
    this.keycloak.login();
  }
}