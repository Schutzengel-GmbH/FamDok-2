import { inject, Injectable } from '@angular/core';
import {
  AnswerCreateManyCaseFormResponseInput,
  CaseFormCreateInput,
  CaseFormResponseCreateInput,
  CaseFormResponseUpdateInput,
  CaseFormResponseWhereInput,
  CaseFormUpdateInput,
  CaseFormWhereInput,
} from '../../../../shared/generated/prisma/models';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { FullCaseForm, FullCaseFormResponse } from '../../../../shared/types';
import { environment } from 'src/environments/environment';
import { AnswerModel as Answer } from '../../../../shared/generated/prisma/models';

@Injectable({
  providedIn: 'root',
})
export class CaseFormService {
  private http = inject(HttpClient);

  protected caseFormResponseApiUrl = environment.apiUrl + '/case-form-response';
  protected caseFormApiUrl = environment.apiUrl + '/case-form-definition';

  /**
   * Fetches case form definitions.
   * @param {CaseFormDefinitionWhereInput} [filter] Optional Prisma where filter
   * @returns {Observable<FullCaseForm[]>} Observable emitting case form definitions
   */
  getCaseForms(filter?: CaseFormWhereInput): Observable<FullCaseForm[]> {
    const params = new URLSearchParams({
      where: filter ? JSON.stringify(filter) : '',
    });
    return this.http.get<FullCaseForm[]>(
      this.caseFormApiUrl + '?' + params.toString(),
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
   * @param {CaseFormResponseWhereInput} [filter] Optional Prisma where filter
   * @returns {Observable<FullCaseFormResponse[]>} Observable emitting the form responses
   */
  getCaseFormResponses(
    filter?: CaseFormResponseWhereInput,
  ): Observable<FullCaseFormResponse[]> {
    const params = new URLSearchParams({
      where: filter ? JSON.stringify(filter) : '',
    });
    return this.http.get<FullCaseFormResponse[]>(
      this.caseFormResponseApiUrl + '?' + params.toString(),
    );
  }

  /**
   * Fetches all case form responses for a given definition.
   * @param {string} definitionId UUID of the case form definition
   * @param {GeneralFormResponseWhereInput} [filter] Optional Prisma where filter
   * @returns {Observable<FullCaseFormResponse[]>} Observable emitting the form responses
   */
  getCaseFormResponsesForForm(
    definitionId: string,
    filter?: CaseFormResponseWhereInput,
  ): Observable<FullCaseFormResponse[]> {
    const where: CaseFormResponseWhereInput = {
      ...filter,
      caseForm: { id: definitionId },
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
   * @param {CaseFormDefinitionCreateInput} caseFormDefinitionData Create input
   * @returns {Observable<FullCaseForm>} Observable emitting the created form definition
   */
  createCaseFormDefinition(
    caseFormDefinitionData: CaseFormCreateInput,
  ): Observable<FullCaseForm> {
    return this.http.post<FullCaseForm>(
      this.caseFormApiUrl,
      caseFormDefinitionData,
    );
  }

  /**
   * Updates a case form definition by ID.
   * @param {string} id UUID of the form definition
   * @param {CaseFormUpdateInput} update Update input
   * @returns {Observable<FullCaseForm>} Observable emitting the updated form definition
   */
  updateCaseFormDefinition(
    id: string,
    update: CaseFormUpdateInput,
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
    answers: Partial<Answer>[] | AnswerCreateManyCaseFormResponseInput[];
  }) {
    const { responseId, caregiverId, childId, caseId, formId, answers } =
      response;
    if (responseId) {
      return this.updateCaseFormResponse(responseId, {
        caregiver: caregiverId
          ? { connect: { id: caregiverId } }
          : { disconnect: true },
        child: childId ? { connect: { id: childId } } : { disconnect: true },
        answers: {
          updateMany: answers.map((a) => ({
            where: { id: a.id! },
            data: {
              answerBool: a.answerBool,
              answerDate: a.answerDate,
              answerInt: a.answerInt,
              answerNum: a.answerNum,
              answerSelectId: a.answerSelectId,
              answerText: a.answerText,
            },
          })),
        },
      });
    } else {
      return this.createCaseFormResponse({
        caseForm: { connect: { id: formId } },
        caregiver: caregiverId ? { connect: { id: caregiverId } } : undefined,
        child: childId ? { connect: { id: childId } } : undefined,
        answers: {
          createMany: {
            data: answers as AnswerCreateManyCaseFormResponseInput[],
          },
        },
        case: {
          connect: { id: caseId },
        },
      });
    }
  }

  /**
   * Creates a case form response.
   * @param {CaseFormResponseCreateInput} caseFormResponsedata Create input
   * @returns {Observable<FullCaseFormResponse>} Observable emitting the created response
   */
  createCaseFormResponse(
    caseFormResponsedata: CaseFormResponseCreateInput,
  ): Observable<FullCaseFormResponse> {
    return this.http.post<FullCaseFormResponse>(
      this.caseFormResponseApiUrl,
      caseFormResponsedata,
    );
  }

  /**
   * Updates a case form response by ID.
   * @param {string} id UUID of the response
   * @param {CaseFormResponseUpdateInput} update Update input
   * @returns {Observable<FullCaseFormResponse>} Observable emitting the updated response
   */
  updateCaseFormResponse(
    id: string,
    update: CaseFormResponseUpdateInput,
  ): Observable<FullCaseFormResponse> {
    return this.http.put<FullCaseFormResponse>(
      this.caseFormResponseApiUrl + '/i/' + id,
      update,
    );
  }

  /**
   * Deletes a case form response by ID.
   * @param {string} id UUID of the response
   * @returns {Observable<FullCaseFormResponse>} Observable emitting the deleted response or deletion result
   */
  deleteCaseFormResponse(id: string): Observable<FullCaseFormResponse> {
    return this.http.delete<FullCaseFormResponse>(
      this.caseFormResponseApiUrl + '/i/' + id,
    );
  }
}
