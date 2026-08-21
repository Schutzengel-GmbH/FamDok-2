import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NgSelectComponent } from '@ng-select/ng-select';

import { SelectUser } from './select-user.component';
import { buildUser } from 'src/app/testing/fixtures';

describe('SelectUser', () => {
  let component: SelectUser;
  let fixture: ComponentFixture<SelectUser>;

  const users = [
    buildUser({ id: 'user-1', email: 'a@example.com' }),
    buildUser({ id: 'user-2', email: 'b@example.com' }),
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectUser],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectUser);
    component = fixture.componentInstance;
  });

  function setup() {
    fixture.componentRef.setInput('users', users);
    fixture.detectChanges();
  }

  it('passes the users input through to the ng-select with the email bindLabel', () => {
    setup();
    const select = fixture.debugElement.query(By.directive(NgSelectComponent))
      .componentInstance as NgSelectComponent;
    expect(select.items()).toEqual(users as any);
    expect(select.bindLabel()).toBe('email');
  });

  it('emits the selected user when the ng-select change output fires', () => {
    setup();
    const emitted: any[] = [];
    component.selectUser.subscribe((u) => emitted.push(u));

    const select = fixture.debugElement.query(By.directive(NgSelectComponent));
    select.triggerEventHandler('change', users[1]);

    expect(emitted).toEqual([users[1]]);
  });
});
