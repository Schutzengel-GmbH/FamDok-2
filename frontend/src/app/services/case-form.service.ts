import { inject, Injectable } from '@angular/core';
import type {
  CaseFormCreateRequest,
  CaseFormListQuery,
  CaseFormResponseCreateRequest,
  CaseFormResponseUpdateRequest,
  CaseFormResponseWhere,
  CaseFormUpdateRequest,
} from '../../../../shared/api';
import { toAnswerRequest, toQuery } from '../util/apiUtils';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { FullCaseForm, FullCaseFormResponse } from '../../../../shared/types';
import { environment } from 'src/environments/environment';
import { AnswerModel as Answer } from '../../../../shared/generated/prisma/models';
import { WarningsService } from './warnings.service';

@Injectable({
  providedIn: 'root',
})
export class CaseFormService {
  private http = inject(HttpClient);
  private warningsService = inject(WarningsService);

  protected caseFormResponseApiUrl = environment.apiUrl + '/case-form-response';
  protected caseFormApiUrl = environment.apiUrl + '/case-form-definition';

  /**
   * Fetches case form definitions.
   * @param {CaseFormListQuery['where']} [where] Optional filter
   * @returns {Observable<FullCaseForm[]>} Observable emitting case form definitions
   */
  getCaseForms(where?: CaseFormListQuery['where']): Observable<FullCaseForm[]> {
    return this.http.get<FullCaseForm[]>(
      this.caseFormApiUrl + toQuery({ where }),
    );
  }

  /**
   * Fetches a single case form definition by ID.
   * @param {string} id UUID of the case form definition
   * @returns {Observable<FullCaseForm>} Observable emitting the form definition
   */
  getCaseForm(id: string): Observable<FullCaseForm> {
    return this.http.get<FullCaseForm>(this.caseFormApiUrl + '/i/' + id);
  }

  /**
   * Fetches all case form responses.
   * @param {CaseFormResponseWhere} [filter] Optional filter
   * @returns {Observable<FullCaseFormResponse[]>} Observable emitting the form responses
   */
  getCaseFormResponses(
    filter?: CaseFormResponseWhere,
  ): Observable<FullCaseFormResponse[]> {
    return this.http.get<FullCaseFormResponse[]>(
      this.caseFormResponseApiUrl + toQuery({ where: filter }),
    );
  }

  /**
   * Fetches all case form responses for a given definition.
   * @param {string} definitionId UUID of the case form definition
   * @param {GeneralFormResponseWhere} [filter] Optional Prisma where filter
   * @returns {Observable<FullCaseFormResponse[]>} Observable emitting the form responses
   */
  getCaseFormResponsesForForm(
    definitionId: string,
    filter?: CaseFormResponseWhere,
  ): Observable<FullCaseFormResponse[]> {
    const where: CaseFormResponseWhere = {
      ...filter,
      caseFormId: definitionId,
    };
    return this.getCaseFormResponses(where);
  }

  /**
   * Fetches a single case form response by ID.
   * @param {string} id UUID of the case form response
   * @returns {Observable<FullCaseFormResponse>} Observable emitting the form response
   */
  getCaseFormResponse(id: string): Observable<FullCaseFormResponse> {
    return this.http.get<FullCaseFormResponse>(
      this.caseFormResponseApiUrl + '/i/' + id,
    );
  }

  /**
   * Creates a case form definition.
   * @param {CaseFormCreateRequest} caseFormDefinitionData Create input
   * @returns {Observable<FullCaseForm>} Observable emitting the created form definition
   */
  createCaseFormDefinition(
    caseFormDefinitionData: CaseFormCreateRequest,
  ): Observable<FullCaseForm> {
    return this.http.post<FullCaseForm>(
      this.caseFormApiUrl,
      caseFormDefinitionData,
    );
  }

  /**
   * Updates a case form definition by ID.
   * @param {string} id UUID of the form definition
   * @param {CaseFormUpdateRequest} update Update input
   * @returns {Observable<FullCaseForm>} Observable emitting the updated form definition
   */
  updateCaseFormDefinition(
    id: string,
    update: CaseFormUpdateRequest,
  ): Observable<FullCaseForm> {
    return this.http.put<FullCaseForm>(
      this.caseFormApiUrl + '/i/' + id,
      update,
    );
  }

  /**
   * Deletes a case form definition by ID. Existing responses referencing it are not
   * deleted, but are orphaned (their caseFormId is set to null by the DB).
   * @param {string} id UUID of the form definition
   * @returns {Observable<FullCaseForm>} Observable emitting the deleted form definition
   */
  deleteCaseFormDefinition(id: string): Observable<FullCaseForm> {
    return this.http.delete<FullCaseForm>(this.caseFormApiUrl + '/i/' + id);
  }

  saveResponse(response: {
    responseId?: string;
    formId: string;
    caseId?: string;
    caregiverId?: string;
    childId?: string;
    answers: Partial<Answer>[];
  }) {
    const { responseId, caregiverId, childId, caseId, formId, answers } =
      response;
    if (responseId) {
      return this.updateCaseFormResponse(responseId, {
        caregiverId: caregiverId ?? null,
        childId: childId ?? null,
        answers: answers.map(toAnswerRequest),
      });
    }

    return this.createCaseFormResponse({
      caseId: caseId!,
      caseFormId: formId,
      caregiverId,
      childId,
      answers: answers.map(({ id, ...answer }) => toAnswerRequest(answer)),
    });
  }

  /**
   * Creates a case form response.
   * @param {CaseFormResponseCreateRequest} caseFormResponsedata Create input
   * @returns {Observable<FullCaseFormResponse>} Observable emitting the created response
   */
  createCaseFormResponse(
    caseFormResponsedata: CaseFormResponseCreateRequest,
  ): Observable<FullCaseFormResponse> {
    return this.http
      .post<FullCaseFormResponse>(
        this.caseFormResponseApiUrl,
        caseFormResponsedata,
      )
      .pipe(this.warningsService.refreshAfter());
  }

  /**
   * Updates a case form response by ID.
   * @param {string} id UUID of the response
   * @param {CaseFormResponseUpdateRequest} update Update input
   * @returns {Observable<FullCaseFormResponse>} Observable emitting the updated response
   */
  updateCaseFormResponse(
    id: string,
    update: CaseFormResponseUpdateRequest,
  ): Observable<FullCaseFormResponse> {
    return this.http
      .put<FullCaseFormResponse>(
        this.caseFormResponseApiUrl + '/i/' + id,
        update,
      )
      .pipe(this.warningsService.refreshAfter());
  }

  /**
   * Deletes a case form response by ID.
   * @param {string} id UUID of the response
   * @returns {Observable<FullCaseFormResponse>} Observable emitting the deleted response or deletion result
   */
  deleteCaseFormResponse(id: string): Observable<FullCaseFormResponse> {
    return this.http
      .delete<FullCaseFormResponse>(this.caseFormResponseApiUrl + '/i/' + id)
      .pipe(this.warningsService.refreshAfter());
  }
}
