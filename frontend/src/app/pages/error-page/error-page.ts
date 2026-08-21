import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-error-page',
  standalone: true,
  imports: [],
  templateUrl: './error-page.html',
  styleUrl: './error-page.scss',
})
export class ErrorPage {
  private activatedRoute = inject(ActivatedRoute);

  code!: string;
  title!: string;
  message!: string;

  constructor() {
    this.code =
      this.activatedRoute.snapshot.queryParamMap.get('code') || 'Fehler';
    this.title = this.activatedRoute.snapshot.queryParamMap.get('title') || '';
    this.message =
      this.activatedRoute.snapshot.queryParamMap.get('message') ||
      'Ein unbekannter Fehler ist aufgetreten.';
  }
}
