import { Router } from 'express';
import { StatsController } from '../controller/StatsController';
import { route } from '../util/routerUtils';
import {
  StatsCaseQuery,
  StatsContactDocumentationQuery,
} from '../../shared/api';

export const StatsRouter = Router();

StatsRouter.get(
  '/case',
  route({ query: StatsCaseQuery }, ({ user, query }) =>
    StatsController.getCases(user, query.where, query.activeBetween)
  )
);

StatsRouter.get(
  '/case/count',
  route({ query: StatsCaseQuery }, ({ user, query }) =>
    StatsController.countCases(user, query.where, query.activeBetween)
  )
);

StatsRouter.get(
  '/contactDocumentation',
  route({ query: StatsContactDocumentationQuery }, ({ user, query }) =>
    StatsController.contactDocumentation(
      user,
      query.caseFilter,
      query.docFilter
    )
  )
);

StatsRouter.get(
  '/cities',
  route(({ user }) =>
    StatsController.getCities(user)
  )
);
