import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ImportSurveyDefinitionComponent } from './import-survey-definition';

describe('ImportSurveyDefinition', () => {
  let component: ImportSurveyDefinitionComponent;
  let fixture: ComponentFixture<ImportSurveyDefinitionComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportSurveyDefinitionComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImportSurveyDefinitionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  it('defaults to CaseForm import and toggles on changeType', () => {
    expect(component.importGeneralForm()).toBeFalse();

    component.changeType();

    expect(component.importGeneralForm()).toBeTrue();
  });

  it('shows a hint when no file has been selected', () => {
    expect(component.tooltip()).toBe('Keine Datei ausgewählt');
  });

  it('shows an error hint when the selected file failed validation', () => {
    component.files = [{}] as unknown as FileList;
    component.fileValid.set(false);

    expect(component.tooltip()).toContain('valides Formular');
  });

  it('submits the parsed CaseForm definition', () => {
    component.input = { name: 'Intake' } as any;

    component.save();

    const req = httpMock.expectOne((r) => r.url.includes('/case-form-definition'));
    expect(req.request.body).toEqual({ name: 'Intake' });
    req.flush({ name: 'Intake' });
  });

  it('submits the parsed GeneralForm definition when importing a general form', () => {
    component.importGeneralForm.set(true);
    component.input = { name: 'Feedback' } as any;

    component.save();

    const req = httpMock.expectOne((r) => r.url.includes('/general-form/definitions'));
    expect(req.request.body).toEqual({ name: 'Feedback' });
    req.flush({ name: 'Feedback' });
  });

  describe('filesChanged', () => {
    function fakeFileList(files: File[]): FileList {
      return {
        length: files.length,
        item: (i: number) => files[i] ?? null,
        [Symbol.iterator]: files[Symbol.iterator].bind(files),
      } as unknown as FileList;
    }

    function waitForRead(): Promise<void> {
      return new Promise((resolve) => {
        (component as any).fileReader.addEventListener('load', () => resolve(), {
          once: true,
        });
      });
    }

    it('does nothing when no file is selected', () => {
      component.filesChanged({ target: { files: fakeFileList([]) } });

      expect(component.tooltip()).toBe('Keine Datei ausgewählt');
    });

    it('marks the file invalid when it fails CaseForm validation', async () => {
      const file = new File(['not valid json'], 'form.json');
      const promise = waitForRead();

      component.filesChanged({ target: { files: fakeFileList([file]) } });
      await promise;

      expect(component.fileValid()).toBeFalse();
      expect(component.tooltip()).toContain('valides Formular');
    });

    it('marks the file invalid when it fails GeneralForm validation', async () => {
      component.importGeneralForm.set(true);
      const file = new File(['not valid json'], 'form.json');
      const promise = waitForRead();

      component.filesChanged({ target: { files: fakeFileList([file]) } });
      await promise;

      expect(component.fileValid()).toBeFalse();
    });
  });

  it('tooltip is empty once a valid file has been selected', () => {
    component.files = [{}] as unknown as FileList;
    component.fileValid.set(true);

    expect(component.tooltip()).toBe('');
  });
});
