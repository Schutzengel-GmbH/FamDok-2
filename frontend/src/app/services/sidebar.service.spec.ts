import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { SidebarService } from './sidebar.service';

@Component({ template: '' })
class Blank {}

describe('SidebarService', () => {
  let service: SidebarService;
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: Blank },
          { path: 'a', component: Blank },
        ]),
      ],
    });

    service = TestBed.inject(SidebarService);
    router = TestBed.inject(Router);
    await router.navigateByUrl('/');
  });

  it('starts closed', () => {
    expect(service.isOpen()).toBeFalse();
  });

  it('toggle flips the open state', () => {
    service.toggle();
    expect(service.isOpen()).toBeTrue();

    service.toggle();
    expect(service.isOpen()).toBeFalse();
  });

  it('open/close set the state directly', () => {
    service.open();
    expect(service.isOpen()).toBeTrue();

    service.close();
    expect(service.isOpen()).toBeFalse();
  });

  it('closes automatically once a navigation completes', async () => {
    service.open();

    await router.navigateByUrl('/a');

    expect(service.isOpen()).toBeFalse();
  });
});
