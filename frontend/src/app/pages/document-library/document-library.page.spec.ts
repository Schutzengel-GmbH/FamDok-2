import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import Keycloak from 'keycloak-js';

import { DocumentLibraryPage } from './document-library.page';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { ToastService } from 'src/app/services/toast.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { environment } from 'src/environments/environment';

describe('DocumentLibraryPage', () => {
  let component: DocumentLibraryPage;
  let fixture: ComponentFixture<DocumentLibraryPage>;
  let httpMock: HttpTestingController;
  let modal: jasmine.SpyObj<NgbModal>;
  let toast: ToastService;
  let confirmDialog: ConfirmDialogService;

  const doc1 = {
    id: 'doc-1',
    title: 'Handbuch',
    description: 'Erste Schritte',
    filename: 'handbuch.pdf',
    tags: [{ id: 'tag-1', name: 'Intern' }],
  };
  const doc2 = {
    id: 'doc-2',
    title: 'Vorlage',
    description: null,
    filename: 'vorlage.docx',
    tags: [],
  };

  function setup() {
    modal = jasmine.createSpyObj('NgbModal', ['open']);

    TestBed.configureTestingModule({
      imports: [DocumentLibraryPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Keycloak, useValue: mockKeycloak() },
        { provide: NgbModal, useValue: modal },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
    confirmDialog = TestBed.inject(ConfirmDialogService);
    fixture = TestBed.createComponent(DocumentLibraryPage);
    component = fixture.componentInstance;

    httpMock
      .expectOne((r) => r.url.includes(`${environment.apiUrl}/document?`))
      .flush([doc1, doc2]);
    httpMock
      .expectOne(`${environment.apiUrl}/document/tags`)
      .flush([{ id: 'tag-1', name: 'Intern' }]);
  }

  afterEach(() => httpMock.verify());

  describe('filteredDocuments', () => {
    it('returns every document when there is no filter', () => {
      setup();
      expect(component['filteredDocuments']().map((d) => d.id)).toEqual([
        'doc-1',
        'doc-2',
      ]);
    });

    it('filters by title or description, case-insensitively', () => {
      setup();
      component['search'].set('erste');
      expect(component['filteredDocuments']().map((d) => d.id)).toEqual([
        'doc-1',
      ]);
    });

    it('filters by selected tags (a document must carry every selected tag)', () => {
      setup();
      component['selectedTags'].set([{ id: 'tag-1', name: 'Intern' } as any]);
      expect(component['filteredDocuments']().map((d) => d.id)).toEqual([
        'doc-1',
      ]);
    });
  });

  it('download delegates to the document service', () => {
    setup();
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');
    spyOn(URL, 'createObjectURL').and.returnValue('blob:mock');
    spyOn(URL, 'revokeObjectURL');

    component['download'](doc1 as any);

    httpMock
      .expectOne((r) => r.url.includes('/document/i/doc-1/download'))
      .flush(new Blob());
    expect(clickSpy).toHaveBeenCalled();
  });

  describe('openUploadModal', () => {
    it('uploads the file and shows a success toast on save', () => {
      setup();
      const file = new File(['x'], 'scan.pdf');
      const meta = { title: 'Scan', tagIds: [] };
      const closed = { subscribe: (cb: any) => cb({ reason: 'save', file, meta }) };
      modal.open.and.returnValue({ componentInstance: {}, closed } as any);

      component['openUploadModal']();

      const req = httpMock.expectOne(`${environment.apiUrl}/document`);
      expect(req.request.method).toBe('POST');
      req.flush(doc1);

      httpMock
        .expectOne((r) => r.url.includes(`${environment.apiUrl}/document?`))
        .flush([doc1]);

      expect(toast.toasts()[0].severity).toBe('success');
    });

    it('shows an error toast when the upload fails', () => {
      setup();
      const file = new File(['x'], 'scan.pdf');
      const meta = { title: 'Scan', tagIds: [] };
      const closed = { subscribe: (cb: any) => cb({ reason: 'save', file, meta }) };
      modal.open.and.returnValue({ componentInstance: {}, closed } as any);

      component['openUploadModal']();

      httpMock
        .expectOne(`${environment.apiUrl}/document`)
        .flush('err', { status: 500, statusText: 'Server Error' });

      expect(toast.toasts()[0].severity).toBe('danger');
    });

    it('does nothing when the modal is cancelled', () => {
      setup();
      const closed = { subscribe: (cb: any) => cb({ reason: 'cancel' }) };
      modal.open.and.returnValue({ componentInstance: {}, closed } as any);

      component['openUploadModal']();

      expect(httpMock.match((r) => r.method === 'POST').length).toBe(0);
    });
  });

  describe('openEditModal', () => {
    it('updates the document and reloads the list on save', () => {
      setup();
      const meta = { title: 'Neuer Titel', tagIds: [] };
      const closed = { subscribe: (cb: any) => cb({ reason: 'save', meta }) };
      modal.open.and.returnValue({ componentInstance: {}, closed } as any);

      component['openEditModal'](doc1 as any);

      const req = httpMock.expectOne(`${environment.apiUrl}/document/i/doc-1`);
      expect(req.request.method).toBe('PUT');
      req.flush({ ...doc1, title: 'Neuer Titel' });

      httpMock
        .expectOne((r) => r.url.includes(`${environment.apiUrl}/document?`))
        .flush([{ ...doc1, title: 'Neuer Titel' }]);

      expect(toast.toasts()[0].severity).toBe('success');
    });
  });

  describe('deleteDocument', () => {
    it('opens a confirm dialog and deletes the document on confirm', () => {
      setup();

      component['deleteDocument'](doc1 as any);
      expect(confirmDialog.openDialogs().length).toBe(1);

      confirmDialog.openDialogs()[0].confirmAction();

      const req = httpMock.expectOne(`${environment.apiUrl}/document/i/doc-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush({});

      httpMock
        .expectOne((r) => r.url.includes(`${environment.apiUrl}/document?`))
        .flush([]);

      expect(toast.toasts()[0].severity).toBe('success');
    });
  });

  describe('addTag', () => {
    it('creates the tag and reloads the tag list on save', () => {
      setup();
      const closed = {
        subscribe: (cb: any) => cb({ reason: 'save', value: 'Neu' }),
      };
      modal.open.and.returnValue({ componentInstance: {}, closed } as any);

      component['addTag']();

      const req = httpMock.expectOne(`${environment.apiUrl}/document/tags`);
      expect(req.request.method).toBe('POST');
      req.flush({ id: 'tag-2', name: 'Neu' });

      httpMock
        .expectOne(`${environment.apiUrl}/document/tags`)
        .flush([{ id: 'tag-1', name: 'Intern' }, { id: 'tag-2', name: 'Neu' }]);

      expect(toast.toasts()[0].severity).toBe('success');
    });
  });

  describe('renameTag', () => {
    it('renames the tag and reloads both tags and documents on save', () => {
      setup();
      const closed = {
        subscribe: (cb: any) => cb({ reason: 'save', value: 'Umbenannt' }),
      };
      modal.open.and.returnValue({ componentInstance: {}, closed } as any);

      component['renameTag']({ id: 'tag-1', name: 'Intern' } as any);

      const req = httpMock.expectOne(`${environment.apiUrl}/document/tags/i/tag-1`);
      expect(req.request.method).toBe('PUT');
      req.flush({ id: 'tag-1', name: 'Umbenannt' });

      httpMock
        .expectOne(`${environment.apiUrl}/document/tags`)
        .flush([{ id: 'tag-1', name: 'Umbenannt' }]);
      httpMock
        .expectOne((r) => r.url.includes(`${environment.apiUrl}/document?`))
        .flush([doc1, doc2]);

      expect(toast.toasts()[0].severity).toBe('success');
    });
  });

  describe('deleteTagAction', () => {
    it('opens a confirm dialog and deletes the tag on confirm', () => {
      setup();

      component['deleteTagAction']({ id: 'tag-1', name: 'Intern' } as any);
      expect(confirmDialog.openDialogs().length).toBe(1);

      confirmDialog.openDialogs()[0].confirmAction();

      const req = httpMock.expectOne(`${environment.apiUrl}/document/tags/i/tag-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush({});

      httpMock.expectOne(`${environment.apiUrl}/document/tags`).flush([]);
      httpMock
        .expectOne((r) => r.url.includes(`${environment.apiUrl}/document?`))
        .flush([]);

      expect(toast.toasts()[0].severity).toBe('success');
    });
  });
});
