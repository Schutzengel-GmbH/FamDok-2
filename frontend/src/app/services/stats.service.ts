import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { AnonCase, AnonContactDocumentation } from '../../../../shared/types';
import { Observable } from 'rxjs';
import {
  CaseFormResponseWhereInput,
  CaseWhereInput,
  ContactDocumentationWhereInput,
  GeneralFormResponseWhereInput,
} from '../../../../shared/generated/prisma/models';
import { Status } from '../../../../shared/generated/prisma/enums';

@Injectable({
  providedIn: 'root',
})
export class StatsService {
  private http = inject(HttpClient);
  statsApiUrl = environment.apiUrl + '/stats';

  getAnonCases(
    filter?: CaseWhereInput,
    activeBetween?: { start: Date; end: Date },
  ) {
    const params = new URLSearchParams({
      where: filter ? JSON.stringify(filter) : '',
      activeBetween: activeBetween ? JSON.stringify(activeBetween) : '',
    });

    return this.http.get<AnonCase[]>(
      this.statsApiUrl + '/case' + '?' + params.toString(),
    );
  }

  getCities(): Observable<string[]> {
    return this.http.get<string[]>(this.statsApiUrl + '/cities');
  }

  countGeneralFormResponses(filter: GeneralFormResponseWhereInput) {
    const params = new URLSearchParams({
      where: filter ? JSON.stringify(filter) : '',
    });

    return this.http.get<number>(
      this.statsApiUrl +
        '/generalFormResponses/count' +
        '?' +
        params.toString(),
    );
  }

  getContactStats(
    caseFilter: CaseWhereInput,
    docFilter: ContactDocumentationWhereInput,
  ) {
    const params = new URLSearchParams({
      caseFilter: caseFilter ? JSON.stringify(caseFilter) : '',
      docFilter: docFilter ? JSON.stringify(docFilter) : '',
    });

    return this.http.get<AnonContactDocumentation[]>(
      this.statsApiUrl + '/contactDocumentation' + '?' + params.toString(),
    );
  }

  countCaseFormResponses(formId: string, filter: CaseFormResponseWhereInput) {
    const params = new URLSearchParams({
      id: formId,
      where: filter ? JSON.stringify(filter) : '',
    });

    return this.http.get<number>(
      this.statsApiUrl + '/caseFormResponses/count' + '?' + params.toString(),
    );
  }

  countCases(
    filter: CaseWhereInput,
    activeBetween?: { start: Date; end: Date },
  ) {
    const params = new URLSearchParams({
      where: filter ? JSON.stringify(filter) : '',
      activeBetween: activeBetween ? JSON.stringify(activeBetween) : '',
    });

    return this.http.get<number>(
      this.statsApiUrl + '/case/count' + '?' + params.toString(),
    );
  }

  /**
   * Filter function that returns true if at least one case is still inProgress, false otherwise
   */
  filterInProgress(case_: AnonCase) {
    return case_.zielvereinbarungen.some((z) => z.status === Status.inProgress);
  }

  /**
   * Filter function that returns true if at least one case is still inProgress, false otherwise
   */
  filterNotInProgress(case_: AnonCase) {
    return case_.zielvereinbarungen.every(
      (z) => z.status !== Status.inProgress,
    );
  }

  makeCaseFilter(input: {
    hasContact?: { start: Date; end: Date };
    hasZielvereinbarungen?: { start: Date; end: Date };
    city?: string;
    plz?: string;
    orgId?: string;
  }): CaseWhereInput {
    const filter: CaseWhereInput = {};

    if (input.hasContact)
      filter.contactDocumentation = {
        some: {
          date: { gte: input.hasContact.start, lte: input.hasContact.end },
        },
      };

    if (input.city)
      filter.family = {
        adress: { path: ['city'], string_contains: input.city },
      };

    if (input.plz)
      filter.family = {
        adress: { path: ['plz'], string_contains: input.plz },
      };

    if (input.hasZielvereinbarungen)
      filter.zielvereinbarungen = {
        some: {
          AND: [
            { startedAt: { gte: input.hasZielvereinbarungen.start } },
            { finishBy: { lte: input.hasZielvereinbarungen.end } },
          ],
        },
      };

    if (input.orgId) filter.organisationId = { equals: input.orgId };

    return filter;
  }
}
