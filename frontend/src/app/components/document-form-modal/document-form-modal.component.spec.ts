import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { DocumentFormModalComponent } from './document-form-modal.component';

describe('DocumentFormModalComponent', () => {
  let component: DocumentFormModalComponent;
  let fixture: ComponentFixture<DocumentFormModalComponent>;
  let activeModal: jasmine.SpyObj<NgbActiveModal>;

  const tags = [
    { id: 'tag-1', name: 'Wichtig' },
    { id: 'tag-2', name: 'Archiv' },
  ] as any;

  beforeEach(async () => {
    activeModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    await TestBed.configureTestingModule({
      imports: [DocumentFormModalComponent],
      providers: [{ provide: NgbActiveModal, useValue: activeModal }],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentFormModalComponent);
    component = fixture.componentInstance;
  });

  function setup(document?: any, allTags = tags) {
    if (document !== undefined) component.document = document;
    component.allTags = allTags;
    fixture.detectChanges();
  }

  it('starts with an empty, invalid form and no tags when creating a new document', () => {
    setup();
    expect(component['isEdit']).toBeFalse();
    expect(component['form'].valid).toBeFalse();
    expect(component['form'].value.title).toBe('');
    expect(component['selectedTags']()).toEqual([]);
  });

  it('pre-fills the form and selected tags when editing an existing document', () => {
    const document = {
      id: 'doc-1',
      title: 'Mein Dokument',
      description: 'Beschreibung',
      tags: [tags[0]],
    };
    setup(document);

    expect(component['isEdit']).toBeTrue();
    expect(component['form'].value.title).toBe('Mein Dokument');
    expect(component['form'].value.description).toBe('Beschreibung');
    expect(component['selectedTags']()).toEqual([tags[0]]);
  });

  it('cannot save a new document without a file, even if the form is valid', () => {
    setup();
    component['form'].patchValue({ title: 'Titel' });

    expect(component['form'].valid).toBeTrue();
    expect(component['canSave']).toBeFalse();
  });

  it('can save a new document once a file is selected', () => {
    setup();
    component['form'].patchValue({ title: 'Titel' });

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const input = document.createElement('input');
    input.type = 'file';
    const fileList = { 0: file, length: 1, item: (i: number) => (i === 0 ? file : null) };
    Object.defineProperty(input, 'files', { value: fileList });
    component.filesChanged({ target: input } as unknown as Event);

    expect(component['file']()).toBe(file);
    expect(component['canSave']).toBeTrue();
  });

  it('can save an edit without selecting a new file', () => {
    setup({ id: 'doc-1', title: 'Titel', description: '', tags: [] });
    expect(component['canSave']).toBeTrue();
  });

  it('closes with the form values, tag ids and file on save', () => {
    setup();
    component['form'].patchValue({ title: 'Titel', description: 'Text' });
    component['selectedTags'].set([tags[1]]);
    const file = new File(['content'], 'test.pdf');
    component['file'].set(file);

    component.save();

    expect(activeModal.close).toHaveBeenCalledWith({
      reason: 'save',
      meta: { title: 'Titel', description: 'Text', tagIds: ['tag-2'] },
      file,
    });
  });

  it('closes with a cancel reason on cancel', () => {
    setup();
    component.cancel();

    expect(activeModal.close).toHaveBeenCalledWith({ reason: 'cancel' });
  });
});
