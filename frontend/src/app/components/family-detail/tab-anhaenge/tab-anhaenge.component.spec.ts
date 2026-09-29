import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import Keycloak from 'keycloak-js';

import { TabAnhaengeComponent } from './tab-anhaenge.component';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { flushSettings } from 'src/app/testing/http-helpers';
import { buildUser } from 'src/app/testing/fixtures';
import { environment } from 'src/environments/environment';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { Role } from '../../../../../../shared/generated/prisma/enums';

describe('TabAnhaengeComponent', () => {
  let component: TabAnhaengeComponent;
  let fixture: ComponentFixture<TabAnhaengeComponent>;
  let httpMock: HttpTestingController;

  function setup(role: Role) {
    TestBed.configureTestingModule({
      imports: [TabAnhaengeComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Keycloak, useValue: mockKeycloak() },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TabAnhaengeComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('selectedCase', { id: 'case-1' } as any);
    fixture.detectChanges();

    flushSettings(httpMock);
    httpMock.expectOne(`${environment.apiUrl}/me`).flush(buildUser({ id: 'me', role }));
    httpMock.expectOne((r) => r.url.includes('/case/i/case-1/attachment')).flush([]);
  }

  afterEach(() => httpMock.verify());

  it('loads attachments on init', () => {
    setup(Role.User);

    expect(component['attachments']()).toEqual([]);
  });

  describe('canUpload', () => {
    it('is false when readOnly', () => {
      setup(Role.User);
      fixture.componentRef.setInput('readOnly', true);

      expect(component['canUpload']).toBeFalse();
    });

    it('is false for Controller (attachments are personal data)', () => {
      setup(Role.Controller);

      expect(component['canUpload']).toBeFalse();
    });

    it('is true for a plain user', () => {
      setup(Role.User);

      expect(component['canUpload']).toBeTrue();
    });
  });

  describe('canDelete', () => {
    it('is true for Admin regardless of uploader', () => {
      setup(Role.Admin);

      expect(component['canDelete']({ uploadedById: 'someone-else' } as any)).toBeTrue();
    });

    it('is true for the uploader', () => {
      setup(Role.User);

      expect(component['canDelete']({ uploadedById: 'me' } as any)).toBeTrue();
    });

    it('is false for a different user', () => {
      setup(Role.User);

      expect(component['canDelete']({ uploadedById: 'someone-else' } as any)).toBeFalse();
    });
  });

  it('filesChanged uploads the file and reloads attachments on success', () => {
    setup(Role.User);
    const file = new File(['x'], 'scan.pdf');
    const input = { files: { item: () => file }, value: 'scan.pdf' } as unknown as HTMLInputElement;

    component.filesChanged({ target: input } as unknown as Event);

    const req = httpMock.expectOne((r) => r.url.includes('/case/i/case-1/attachment'));
    expect(req.request.method).toBe('POST');
    req.flush({});

    httpMock.expectOne((r) => r.url.includes('/case/i/case-1/attachment')).flush([]);
    expect(input.value).toBe('');
  });

  it('filesChanged does nothing when no file is selected', () => {
    setup(Role.User);
    const input = { files: { item: () => null }, value: '' } as unknown as HTMLInputElement;

    component.filesChanged({ target: input } as unknown as Event);

    expect(httpMock.match((r) => r.method === 'POST').length).toBe(0);
  });

  it('download delegates to CaseService', () => {
    setup(Role.User);
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');
    spyOn(URL, 'createObjectURL').and.returnValue('blob:mock');
    spyOn(URL, 'revokeObjectURL');

    component.download({ id: 'att-1', filename: 'scan.pdf' } as any);

    httpMock
      .expectOne((r) => r.url.includes('/attachment/i/att-1/download'))
      .flush(new Blob());
    expect(clickSpy).toHaveBeenCalled();
  });

  it('deleteAttachment opens a confirm dialog, and confirming it deletes the attachment', () => {
    setup(Role.User);
    const dialogService = TestBed.inject(ConfirmDialogService);

    component.deleteAttachment({ id: 'att-1', filename: 'scan.pdf' } as any);

    expect(dialogService.openDialogs().length).toBe(1);

    dialogService.openDialogs()[0].confirmAction();

    const req = httpMock.expectOne((r) => r.url.includes('/attachment/i/att-1'));
    expect(req.request.method).toBe('DELETE');
    req.flush({});

    httpMock.expectOne((r) => r.url.includes('/case/i/case-1/attachment')).flush([]);
  });
});
