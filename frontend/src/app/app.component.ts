import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { MenuComponent } from './components/menu/menu.component';
import { ToastContainer } from './components/toast-container/toast-container';
import { ConfirmDialogContainer } from './components/confirm-dialog/confirm-dialog-container.component';
import { SidebarService } from './services/sidebar.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    HeaderComponent,
    MenuComponent,
    ToastContainer,
    ConfirmDialogContainer,
  ],
  templateUrl: 'app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  protected sidebar = inject(SidebarService);
}
