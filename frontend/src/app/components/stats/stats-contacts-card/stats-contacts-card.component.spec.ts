import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatsContactCard } from './stats-contacts-card.component';
import { BETREUUNG_ID } from '../../../../../../shared/sharedGlobals';

describe('StatsContactCard', () => {
  let component: StatsContactCard;
  let fixture: ComponentFixture<StatsContactCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatsContactCard],
    }).compileComponents();
    fixture = TestBed.createComponent(StatsContactCard);
    component = fixture.componentInstance;
  });

  it('counts documentation entries matching a given artDerBetreuung id', () => {
    fixture.componentRef.setInput('docs', [
      { artDerBetreuung: BETREUUNG_ID.HAUSBESUCH },
      { artDerBetreuung: BETREUUNG_ID.TELEFONAT },
      { artDerBetreuung: BETREUUNG_ID.HAUSBESUCH },
    ] as any);
    fixture.detectChanges();

    expect(component.countBy(BETREUUNG_ID.HAUSBESUCH)).toBe(2);
    expect(component.countBy(BETREUUNG_ID.TELEFONAT)).toBe(1);
    expect(component.countBy(BETREUUNG_ID.ONLINE)).toBe(0);
  });
});
