import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { Observable } from 'rxjs';
import {
  FullGeneralForm,
  FullGeneralFormResponse,
} from '../../../../shared/types';
import { AnswerModel as Answer } from '../../../../shared/generated/prisma/models';
import type {
  GeneralFormCreateRequest,
  GeneralFormListQuery,
  GeneralFormResponseCreateRequest,
  GeneralFormResponseUpdateRequest,
  GeneralFormResponseWhere,
  GeneralFormUpdateRequest,
} from '../../../../shared/api';
import { toAnswerRequest, toQuery } from '../util/apiUtils';

@Injectable({
  providedIn: 'root',
})
export class GeneralFormService {
  private http = inject(HttpClient);

  private definitionApiUrl = environment.apiUrl + '/general-form/definitions';
  private responseApiUrl = environment.apiUrl + '/general-form/responses';

  getDefinitions(
    where?: GeneralFormListQuery['where'],
  ): Observable<FullGeneralForm[]> {
    return this.http.get<FullGeneralForm[]>(
      this.definitionApiUrl + toQuery({ where }),
    );
  }

  getDefinition(id: string): Observable<FullGeneralForm> {
    return this.http.get<FullGeneralForm>(this.definitionApiUrl + '/i/' + id);
  }

  createDefinition(data: GeneralFormCreateRequest): Observable<FullGeneralForm> {
    return this.http.post<FullGeneralForm>(this.definitionApiUrl, data);
  }

  updateDefinition(
    id: string,
    data: GeneralFormUpdateRequest,
  ): Observable<FullGeneralForm> {
    return this.http.put<FullGeneralForm>(
      this.definitionApiUrl + '/i/' + id,
      data,
    );
  }

  deleteDefinition(id: string): Observable<FullGeneralForm> {
    return this.http.delete<FullGeneralForm>(
      this.definitionApiUrl + '/i/' + id,
    );
  }

  getResponses(
    where?: GeneralFormResponseWhere,
  ): Observable<FullGeneralFormResponse[]> {
    return this.http.get<FullGeneralFormResponse[]>(
      this.responseApiUrl + toQuery({ where }),
    );
  }

  getResponsesFromUser(userId: string, where?: GeneralFormResponseWhere) {
    return this.getResponses({ ...where, userId });
  }

  getResponsesForDefinition(
    definitionId: string,
    where?: GeneralFormResponseWhere,
  ) {
    return this.getResponses({
      ...where,
      generalFormId: definitionId,
    });
  }

  getResponse(id: string): Observable<FullGeneralFormResponse> {
    return this.http.get<FullGeneralFormResponse>(
      this.responseApiUrl + '/i/' + id,
    );
  }

  createResponse(
    data: GeneralFormResponseCreateRequest,
  ): Observable<FullGeneralFormResponse> {
    return this.http.post<FullGeneralFormResponse>(this.responseApiUrl, data);
  }

  updateResponse(
    id: string,
    data: GeneralFormResponseUpdateRequest,
  ): Observable<FullGeneralFormResponse> {
    return this.http.put<FullGeneralFormResponse>(
      this.responseApiUrl + '/i/' + id,
      data,
    );
  }

  saveResponse(response: {
    responseId?: string;
    formId: string;
    answers: Partial<Answer>[];
  }) {
    const { responseId, formId, answers } = response;
    if (responseId) {
      return this.updateResponse(responseId, {
        answers: answers.map(toAnswerRequest),
      });
    }

    return this.createResponse({
      generalFormId: formId,
      answers: answers.map(({ id, ...answer }) => toAnswerRequest(answer)),
    });
  }

  deleteResponse(id: string): Observable<FullGeneralFormResponse> {
    return this.http.delete<FullGeneralFormResponse>(
      this.responseApiUrl + '/i/' + id,
    );
  }
}
