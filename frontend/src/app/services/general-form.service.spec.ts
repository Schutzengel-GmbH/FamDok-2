import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { GeneralFormService } from './general-form.service';
import { environment } from 'src/environments/environment';

describe('GeneralFormService', () => {
  let service: GeneralFormService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GeneralFormService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getDefinitions GETs definitions, optionally filtered', () => {
    let result: unknown;
    service.getDefinitions().subscribe((r) => (result = r));
    httpMock.expectOne(`${environment.apiUrl}/general-form/definitions`).flush([]);
    expect(result).toEqual([]);
  });

  it('getDefinition GETs a single definition by id', () => {
    service.getDefinition('form-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/general-form/definitions/i/form-1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('createDefinition POSTs a new definition', () => {
    service.createDefinition({ name: 'Feedback' } as any).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/general-form/definitions`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('updateDefinition PUTs the update', () => {
    service.updateDefinition('form-1', { name: 'Renamed' } as any).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/general-form/definitions/i/form-1`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('deleteDefinition DELETEs by id', () => {
    service.deleteDefinition('form-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/general-form/definitions/i/form-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('getResponsesFromUser scopes the filter to the given user', () => {
    service.getResponsesFromUser('user-1').subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/general-form/responses'));
    expect(decodeURIComponent(req.request.url)).toContain('"userId":"user-1"');
    req.flush([]);
  });

  it('getResponsesForDefinition scopes the filter to the given definition', () => {
    service.getResponsesForDefinition('form-1').subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/general-form/responses'));
    expect(decodeURIComponent(req.request.url)).toContain('"generalFormId":"form-1"');
    req.flush([]);
  });

  it('getResponse GETs a single response by id', () => {
    service.getResponse('resp-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/general-form/responses/i/resp-1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('deleteResponse DELETEs by id', () => {
    service.deleteResponse('resp-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/general-form/responses/i/resp-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  describe('saveResponse', () => {
    it('updates the existing response when a responseId is given', () => {
      service
        .saveResponse({
          responseId: 'resp-1',
          formId: 'form-1',
          answers: [{ id: 'answer-1', answerText: 'hi' } as any],
        })
        .subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/general-form/responses/i/resp-1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body.answers.updateMany[0].where).toEqual({ id: 'answer-1' });
      expect(req.request.body.answers.updateMany[0].data.answerText).toBe('hi');
      req.flush({});
    });

    it('creates a new response when no responseId is given', () => {
      service
        .saveResponse({
          responseId: undefined,
          formId: 'form-1',
          answers: [{ questionId: 'q1', answerText: 'hi' } as any],
        })
        .subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/general-form/responses`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.form).toEqual({ connect: { id: 'form-1' } });
      expect(req.request.body.answers.createMany.data).toEqual([
        { questionId: 'q1', answerText: 'hi' },
      ]);
      req.flush({});
    });
  });
});
