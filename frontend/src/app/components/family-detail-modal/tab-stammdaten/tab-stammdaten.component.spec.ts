import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { TabStammdatenComponent } from './tab-stammdaten.component';

describe('TabStammdatenComponent', () => {
  let component: TabStammdatenComponent;
  let fixture: ComponentFixture<TabStammdatenComponent>;
  const child = { id: 'child-1', name: 'Max' };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabStammdatenComponent],
      providers: [provideCharts(withDefaultRegisterables())],
    }).compileComponents();

    fixture = TestBed.createComponent(TabStammdatenComponent);
    component = fixture.componentInstance;
    component.selectedCase = {
      family: { children: [child], caregiver: [] },
      contactDocumentation: [],
    } as any;
    fixture.detectChanges();
  });

  it('has no selected child by default', () => {
    expect(component['selectedChild']()).toBeUndefined();
  });

  it('resolves the selected child from the case family', () => {
    component['selectedChildId'].set('child-1');

    expect(component['selectedChild']()).toEqual(child as any);
  });

  it('ngOnChanges resets the selected child when the case changes', () => {
    component['selectedChildId'].set('child-1');

    component.ngOnChanges({ selectedCase: {} as any });

    expect(component['selectedChildId']()).toBeUndefined();
  });

  describe('getAdressString', () => {
    it('formats a full address', () => {
      expect(
        component.getAdressString({ street: 'Hauptstr.', number: '1', plz: '12345', city: 'Berlin' }),
      ).toBe('Hauptstr. 1, 12345 Berlin');
    });

    it('falls back to a placeholder when there is no address', () => {
      expect(component.getAdressString(null)).toBe('Keine Adresse hinterlegt');
    });
  });
});
