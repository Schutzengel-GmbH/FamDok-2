import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectPersonComponent } from './select-person-component';

describe('SelectPersonComponent', () => {
  let component: SelectPersonComponent;
  let fixture: ComponentFixture<SelectPersonComponent>;

  const child = { id: 'child-1', name: 'Max', lastName: 'Muster' };
  const caregiver = { id: 'cg-1', name: 'Anna', lastName: 'Muster', relation: 'mother' };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectPersonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectPersonComponent);
    component = fixture.componentInstance;
  });

  it('has no persons when no case is selected', () => {
    fixture.detectChanges();

    expect(component.persons()).toEqual([]);
  });

  it('lists children and caregivers from the case family', () => {
    fixture.componentRef.setInput('case', {
      family: { children: [child], caregiver: [caregiver] },
    } as any);
    fixture.detectChanges();

    expect(component.persons()).toEqual([
      { id: 'child-1', name: 'Max Muster', type: 'Kind' },
      { id: 'cg-1', name: 'Anna Muster', type: 'Eltern' },
    ]);
  });

  it('selects the matching caregiver by id', () => {
    fixture.componentRef.setInput('case', {
      family: { children: [child], caregiver: [caregiver] },
    } as any);
    fixture.detectChanges();

    component.select({ id: 'cg-1', name: 'Anna Muster', type: 'Eltern' });

    expect(component.person()).toEqual(caregiver as any);
  });

  it('selects the matching child by id when no caregiver matches', () => {
    fixture.componentRef.setInput('case', {
      family: { children: [child], caregiver: [caregiver] },
    } as any);
    fixture.detectChanges();

    component.select({ id: 'child-1', name: 'Max Muster', type: 'Kind' });

    expect(component.person()).toEqual(child as any);
  });

  it('sets person to undefined when nothing matches', () => {
    fixture.componentRef.setInput('case', {
      family: { children: [child], caregiver: [caregiver] },
    } as any);
    fixture.detectChanges();

    component.select({ id: 'unknown', name: '?', type: 'Kind' });

    expect(component.person()).toBeUndefined();
  });

  it('labels a non-parent caregiver as "Sonstige Bezugsperson"', () => {
    const otherCaregiver = { id: 'cg-2', name: 'Onkel', lastName: 'Muster', relation: 'other' };
    fixture.componentRef.setInput('case', {
      family: { children: [], caregiver: [otherCaregiver] },
    } as any);
    fixture.detectChanges();

    expect(component.persons()).toEqual([
      { id: 'cg-2', name: 'Onkel Muster', type: 'Sonstige Bezugsperson' },
    ]);
  });
});
