import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { CaseFormService } from './case-form.service';
import { environment } from 'src/environments/environment';

describe('CaseFormService', () => {
  let service: CaseFormService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CaseFormService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getCaseForms GETs form definitions', () => {
    service.getCaseForms().subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/case-form-definition'));
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getCaseForm GETs a single definition by id', () => {
    service.getCaseForm('form-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/case-form-definition/i/form-1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('getCaseFormResponsesForForm scopes the filter to the given definition', () => {
    service.getCaseFormResponsesForForm('form-1').subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/case-form-response'));
    expect(decodeURIComponent(req.request.url)).toContain('"caseForm":{"id":"form-1"}');
    req.flush([]);
  });

  it('getCaseFormResponse GETs a single response by id', () => {
    service.getCaseFormResponse('resp-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/case-form-response/i/resp-1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('createCaseFormDefinition POSTs the new definition', () => {
    service.createCaseFormDefinition({ name: 'Intake' } as any).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/case-form-definition`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('updateCaseFormDefinition PUTs the update', () => {
    service.updateCaseFormDefinition('form-1', {} as any).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/case-form-definition/i/form-1`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('deleteCaseFormDefinition DELETEs by id', () => {
    service.deleteCaseFormDefinition('form-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/case-form-definition/i/form-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('deleteCaseFormResponse DELETEs by id', () => {
    service.deleteCaseFormResponse('resp-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/case-form-response/i/resp-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  describe('saveResponse', () => {
    it('updates an existing response, connecting the given caregiver/child', () => {
      service
        .saveResponse({
          responseId: 'resp-1',
          formId: 'form-1',
          caregiverId: 'cg-1',
          childId: 'child-1',
          answers: [{ id: 'answer-1', answerText: 'hi' } as any],
        })
        .subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/case-form-response/i/resp-1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body.caregiver).toEqual({ connect: { id: 'cg-1' } });
      expect(req.request.body.child).toEqual({ connect: { id: 'child-1' } });
      req.flush({});
    });

    it('disconnects caregiver/child on update when none is given', () => {
      service
        .saveResponse({ responseId: 'resp-1', formId: 'form-1', answers: [] })
        .subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/case-form-response/i/resp-1`);
      expect(req.request.body.caregiver).toEqual({ disconnect: true });
      expect(req.request.body.child).toEqual({ disconnect: true });
      req.flush({});
    });

    it('creates a new response scoped to the case, form, and answers', () => {
      service
        .saveResponse({
          formId: 'form-1',
          caseId: 'case-1',
          answers: [{ questionId: 'q1', answerText: 'hi' } as any],
        })
        .subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/case-form-response`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.caseForm).toEqual({ connect: { id: 'form-1' } });
      expect(req.request.body.case).toEqual({ connect: { id: 'case-1' } });
      expect(req.request.body.answers.createMany.data).toEqual([
        { questionId: 'q1', answerText: 'hi' },
      ]);
      req.flush({});
    });
  });
});
