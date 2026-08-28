import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { TextQuestionFilter } from './text-question-filter.component';
import { buildQuestion } from 'src/app/testing/fixtures';

describe('TextQuestionFilter', () => {
  let component: TextQuestionFilter;
  let fixture: ComponentFixture<TextQuestionFilter>;
  let modal: jasmine.SpyObj<NgbModal>;

  beforeEach(async () => {
    modal = jasmine.createSpyObj('NgbModal', ['open']);

    await TestBed.configureTestingModule({
      imports: [TextQuestionFilter],
      providers: [{ provide: NgbModal, useValue: modal }],
    }).compileComponents();
    fixture = TestBed.createComponent(TextQuestionFilter);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('question', buildQuestion());
    fixture.detectChanges();
  });

  it('apply emits an empty filter when the value is undefined', () => {
    let emitted: unknown;
    component.filterChanged.subscribe((f) => (emitted = f));

    component.apply();

    expect(component.active()).toBeTrue();
    expect(emitted).toEqual({});
  });

  it('apply emits the given text value', () => {
    let emitted: unknown;
    component.filterInput = 'hallo';
    component.filterChanged.subscribe((f) => (emitted = f));

    component.apply();

    expect(emitted).toEqual(
      jasmine.objectContaining({ answerText: { contains: 'hallo', mode: 'insensitive' } }),
    );
  });

  it('cancel resets and emits an empty filter', () => {
    component.filterInput = 'hallo';
    component.apply();
    let emitted: unknown;
    component.filterChanged.subscribe((f) => (emitted = f));

    component.cancel();

    expect(component.active()).toBeFalse();
    expect(component.filterInput).toBeUndefined();
    expect(emitted).toEqual({});
  });

  it('options falls back to an empty array when the question has no selectOptions', () => {
    fixture.componentRef.setInput('question', buildQuestion({ selectOptions: undefined }));

    expect(component.options()).toEqual([]);
  });

  describe('open', () => {
    it('applies the filter when the modal resolves with "apply"', async () => {
      modal.open.and.returnValue({ result: Promise.resolve('apply') } as any);
      const applySpy = spyOn(component, 'apply');

      component.open({} as any);
      await fixture.whenStable();

      expect(applySpy).toHaveBeenCalled();
    });

    it('cancels the filter when the modal resolves with anything else', async () => {
      modal.open.and.returnValue({ result: Promise.resolve('dismiss') } as any);
      const cancelSpy = spyOn(component, 'cancel');

      component.open({} as any);
      await fixture.whenStable();

      expect(cancelSpy).toHaveBeenCalled();
    });
  });
});
