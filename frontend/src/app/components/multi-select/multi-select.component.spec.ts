import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MultiSelect } from './multi-select.component';

interface Item {
  id: string;
  label: string;
}

describe('MultiSelect', () => {
  let component: MultiSelect<Item>;
  let fixture: ComponentFixture<MultiSelect<Item>>;

  const items: Item[] = [
    { id: '1', label: 'Eins' },
    { id: '2', label: 'Zwei' },
    { id: '3', label: 'Drei' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MultiSelect],
    }).compileComponents();

    fixture = TestBed.createComponent(
      MultiSelect,
    ) as unknown as ComponentFixture<MultiSelect<Item>>;
    component = fixture.componentInstance;
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
  });

  it('label() returns the raw item when no labelProp is set', () => {
    expect(component['label'](items[0])).toBe(items[0]);
  });

  it('label() returns the given property when labelProp is set', () => {
    fixture.componentRef.setInput('labelProp', 'label');
    expect(component['label'](items[0])).toBe('Eins');
  });

  describe('itemClick', () => {
    it('adds an unselected item to value and emits selectChange', () => {
      let emitted: Item[] | undefined;
      component.selectChange.subscribe((v) => (emitted = v));

      component['itemClick'](items[0]);

      expect(component.value()).toEqual([items[0]]);
      expect(emitted).toEqual([items[0]]);
    });

    it('removes an already-selected item and emits the shrunk selection', () => {
      component.value.set([items[0], items[1]]);
      let emitted: Item[] | undefined;
      component.selectChange.subscribe((v) => (emitted = v));

      component['itemClick'](items[0]);

      expect(component.value()).toEqual([items[1]]);
      expect(emitted).toEqual([items[1]]);
    });
  });

  describe('selected', () => {
    it('uses strict equality by default, so an equal-but-distinct object is not selected', () => {
      component.value.set([items[0]]);

      expect(component['selected'](items[0])).toBeTrue();
      expect(component['selected'](items[1])).toBeFalse();
      expect(component['selected']({ ...items[0] })).toBeFalse();
    });

    it('uses a custom compareFn when provided', () => {
      fixture.componentRef.setInput(
        'compareFn',
        (a: Item, b: Item) => a.id === b.id,
      );
      component.value.set([{ ...items[0] }]);

      expect(component['selected'](items[0])).toBeTrue();
    });
  });

  describe('valueText', () => {
    it('is empty when nothing is selected', () => {
      expect(component['valueText']()).toBe('');
    });

    it('joins the labelProp values of the selected items when labelProp is set', () => {
      fixture.componentRef.setInput('labelProp', 'label');
      component.value.set([items[0], items[1]]);

      expect(component['valueText']()).toBe('Eins, Zwei');
    });

    it('recomputes when the selection changes', () => {
      fixture.componentRef.setInput('labelProp', 'label');
      component.value.set([items[0]]);
      expect(component['valueText']()).toBe('Eins');

      component.value.set([items[0], items[2]]);
      expect(component['valueText']()).toBe('Eins, Drei');
    });
  });

  describe('placeholder', () => {
    it('defaults to a German placeholder', () => {
      expect(component.placeholder()).toBe('Elemente auswählen');
    });

    it('can be overridden', () => {
      fixture.componentRef.setInput('placeholder', 'Bitte wählen');
      expect(component.placeholder()).toBe('Bitte wählen');
    });
  });

  describe('maximum, rendered via the template', () => {
    it('disables the not-yet-selected items once the maximum is reached, but leaves selected ones enabled', () => {
      fixture.componentRef.setInput('labelProp', 'label');
      fixture.componentRef.setInput('maximum', 1);
      component.value.set([items[0]]);
      fixture.detectChanges();

      const buttons: NodeListOf<HTMLButtonElement> =
        fixture.nativeElement.querySelectorAll('button.dropdown-item');
      expect(buttons.length).toBe(3);
      expect(buttons[0].disabled).toBeFalse();
      expect(buttons[1].disabled).toBeTrue();
      expect(buttons[2].disabled).toBeTrue();
    });
  });
});
