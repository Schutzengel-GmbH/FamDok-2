import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FachkraftKpiRowComponent } from './fachkraft-kpi-row.component';
import { Status } from '../../../../../shared/generated/prisma/enums';

describe('FachkraftKpiRowComponent', () => {
  let component: FachkraftKpiRowComponent;
  let fixture: ComponentFixture<FachkraftKpiRowComponent>;

  function setCases(cases: any[]) {
    fixture.componentRef.setInput('cases', cases);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FachkraftKpiRowComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FachkraftKpiRowComponent);
    component = fixture.componentInstance;
  });

  it('defaults every card to 0 before any cases are set', () => {
    expect(component['cards'].every((c) => c.value === 0)).toBeTrue();
    expect(component['cards'].length).toBe(4);
  });

  it('counts the total number of cases', () => {
    setCases([{}, {}, {}]);

    expect(component['cards'][0]).toEqual(
      jasmine.objectContaining({ label: 'Familien in Betreuung', value: 3 }),
    );
  });

  it('sums in-progress zielvereinbarungen across all cases', () => {
    setCases([
      {
        zielvereinbarungen: [
          { status: Status.inProgress },
          { status: Status.done },
        ],
      },
      { zielvereinbarungen: [{ status: Status.inProgress }] },
      { zielvereinbarungen: undefined },
    ]);

    expect(component['cards'][1]).toEqual(
      jasmine.objectContaining({ label: 'Offene Zielvereinbarungen', value: 2 }),
    );
  });

  it('counts cases whose latest contact documentation is within the last 30 days', () => {
    const now = new Date();
    const recent = new Date(now);
    recent.setDate(now.getDate() - 5);
    const old = new Date(now);
    old.setDate(now.getDate() - 40);

    setCases([
      { contactDocumentation: [{ date: recent }] },
      { contactDocumentation: [{ date: old }] },
      { contactDocumentation: [] },
      { contactDocumentation: undefined },
    ]);

    expect(component['cards'][2]).toEqual(
      jasmine.objectContaining({ label: 'Kontakte letzte 30 Tage', value: 1 }),
    );
  });

  it('counts cases with no contact documentation at all', () => {
    setCases([
      { contactDocumentation: [] },
      { contactDocumentation: undefined },
      { contactDocumentation: [{ date: new Date() }] },
    ]);

    expect(component['cards'][3]).toEqual(
      jasmine.objectContaining({ label: 'Fälle ohne Kontakt', value: 2 }),
    );
  });

  it('recomputes all cards together when the cases input changes again', () => {
    setCases([{}, {}]);
    expect(component['cards'][0].value).toBe(2);

    setCases([{}]);
    expect(component['cards'][0].value).toBe(1);
  });
});
