import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatsCountCasesCard } from './stats-count-cases-card.component';

describe('StatsCountCasesCard', () => {
  let component: StatsCountCasesCard;
  let fixture: ComponentFixture<StatsCountCasesCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatsCountCasesCard],
    }).compileComponents();
    fixture = TestBed.createComponent(StatsCountCasesCard);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('count', 42);
    fixture.detectChanges();
  });

  it('exposes the given count', () => {
    expect(component.count()).toBe(42);
  });
});
