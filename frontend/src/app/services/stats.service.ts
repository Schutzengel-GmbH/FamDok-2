import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { AnonCase, AnonContactDocumentation } from '../../../../shared/types';
import { Observable } from 'rxjs';
import { Status } from '../../../../shared/generated/prisma/enums';
import type {
  AnonCaseWhere,
  StatsCaseQuery,
  StatsContactDocumentationQuery,
} from '../../../../shared/api';
import { toQuery } from '../util/apiUtils';

type ActiveBetween = StatsCaseQuery['activeBetween'];

@Injectable({
  providedIn: 'root',
})
export class StatsService {
  private http = inject(HttpClient);
  statsApiUrl = environment.apiUrl + '/stats';

  getAnonCases(where?: AnonCaseWhere, activeBetween?: ActiveBetween) {
    return this.http.get<AnonCase[]>(
      this.statsApiUrl + '/case' + toQuery({ where, activeBetween }),
    );
  }

  getCities(): Observable<string[]> {
    return this.http.get<string[]>(this.statsApiUrl + '/cities');
  }

  getContactStats(
    caseFilter: StatsContactDocumentationQuery['caseFilter'],
    docFilter: StatsContactDocumentationQuery['docFilter'],
  ) {
    return this.http.get<AnonContactDocumentation[]>(
      this.statsApiUrl +
        '/contactDocumentation' +
        toQuery({ caseFilter, docFilter }),
    );
  }

  countCases(where: AnonCaseWhere, activeBetween?: ActiveBetween) {
    return this.http.get<number>(
      this.statsApiUrl + '/case/count' + toQuery({ where, activeBetween }),
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
  }): AnonCaseWhere {
    const filter: AnonCaseWhere = {};

    if (input.hasContact)
      filter.contactDocumentation = {
        some: {
          date: { gte: input.hasContact.start, lte: input.hasContact.end },
        },
      };

    if (input.city) filter.city = { contains: input.city };

    if (input.plz) filter.plz = { contains: input.plz };

    if (input.hasZielvereinbarungen)
      filter.zielvereinbarungen = {
        some: {
          startedAt: { gte: input.hasZielvereinbarungen.start },
          finishBy: { lte: input.hasZielvereinbarungen.end },
        },
      };

    if (input.orgId) filter.organisationId = { equals: input.orgId };

    return filter;
  }
}
