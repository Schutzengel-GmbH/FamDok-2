import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { Observable } from 'rxjs';
import {
  FullGeneralForm,
  FullGeneralFormResponse,
} from '../../../../shared/types';
import { AnswerModel as Answer } from '../../../../shared/generated/prisma/models';
import {
  AnswerCreateManyCaseFormResponseInput,
  GeneralFormCreateInput,
  GeneralFormResponseCreateInput,
  GeneralFormResponseUpdateInput,
  GeneralFormResponseWhereInput,
  GeneralFormUpdateInput,
  GeneralFormWhereInput,
} from '../../../../shared/generated/prisma/models';

@Injectable({
  providedIn: 'root',
})
export class GeneralFormService {
  private http = inject(HttpClient);

  private definitionApiUrl = environment.apiUrl + '/general-form/definitions';
  private responseApiUrl = environment.apiUrl + '/general-form/responses';

  getDefinitions(where?: GeneralFormWhereInput): Observable<FullGeneralForm[]> {
    return this.http.get<FullGeneralForm[]>(
      this.definitionApiUrl + (where ? `?where=${JSON.stringify(where)}` : ''),
    );
  }

  getDefinition(id: string): Observable<FullGeneralForm> {
    return this.http.get<FullGeneralForm>(this.definitionApiUrl + '/i/' + id);
  }

  createDefinition(data: GeneralFormCreateInput): Observable<FullGeneralForm> {
    return this.http.post<FullGeneralForm>(this.definitionApiUrl, data);
  }

  updateDefinition(
    id: string,
    data: GeneralFormUpdateInput,
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
    where?: GeneralFormResponseWhereInput,
  ): Observable<FullGeneralFormResponse[]> {
    return this.http.get<FullGeneralFormResponse[]>(
      this.responseApiUrl + (where ? `?where=${JSON.stringify(where)}` : ''),
    );
  }

  getResponsesFromUser(userId: string, where?: GeneralFormResponseWhereInput) {
    return this.getResponses({ ...where, userId });
  }

  getResponsesForDefinition(
    definitionId: string,
    where?: GeneralFormResponseWhereInput,
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
    data: GeneralFormResponseCreateInput,
  ): Observable<FullGeneralFormResponse> {
    return this.http.post<FullGeneralFormResponse>(this.responseApiUrl, data);
  }

  updateResponse(
    id: string,
    data: GeneralFormResponseUpdateInput,
  ): Observable<FullGeneralFormResponse> {
    return this.http.put<FullGeneralFormResponse>(
      this.responseApiUrl + '/i/' + id,
      data,
    );
  }

  saveResponse(
    response:
      | {
          responseId: string;
          formId: string;
          answers: Partial<Answer>[];
        }
      | {
          responseId: undefined;
          formId: string;
          answers: AnswerCreateManyCaseFormResponseInput[];
        },
  ) {
    const { responseId, formId, answers } = response;
    if (responseId) {
      return this.updateResponse(responseId, {
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
      return this.createResponse({
        form: { connect: { id: formId } },
        answers: {
          createMany: {
            data: answers as AnswerCreateManyCaseFormResponseInput[],
          },
        },
      });
    }
  }

  deleteResponse(id: string): Observable<FullGeneralFormResponse> {
    return this.http.delete<FullGeneralFormResponse>(
      this.responseApiUrl + '/i/' + id,
    );
  }
}
