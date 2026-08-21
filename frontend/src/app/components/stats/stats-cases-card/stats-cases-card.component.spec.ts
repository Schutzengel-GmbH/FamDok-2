import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatsCasesCardComponent } from './stats-cases-card.component';

describe('StatsCasesCardComponent', () => {
  let component: StatsCasesCardComponent;
  let fixture: ComponentFixture<StatsCasesCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatsCasesCardComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(StatsCasesCardComponent);
    component = fixture.componentInstance;
  });

  it('defaults to an empty case list', () => {
    fixture.detectChanges();

    expect(component.cases).toEqual([]);
  });

  it('renders the given cases', () => {
    component.cases = [
      { id: 'case-1', startedAt: new Date('2026-01-01'), zielvereinbarungen: [] } as any,
    ];
    fixture.detectChanges();

    expect(component.cases.length).toBe(1);
  });
});
