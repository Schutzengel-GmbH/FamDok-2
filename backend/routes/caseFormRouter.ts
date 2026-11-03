import { Router } from 'express';
import { CaseFormController } from '../controller/CaseFormController';
import { route } from '../util/routerUtils';
import {
  CaseFormCreateRequest,
  CaseFormListQuery,
  CaseFormUpdateRequest,
} from '../../shared/api';

const CaseFormRouter = Router();

CaseFormRouter.get(
  '/',
  route({ query: CaseFormListQuery }, ({ user, query }) =>
    query.where
      ? CaseFormController.getWhere(user, query.where)
      : CaseFormController.getAll(user)
  )
);

CaseFormRouter.get(
  '/i/:id',
  route(({ user, params }) =>
    CaseFormController.get(user, params.id)
  )
);

CaseFormRouter.post(
  '/',
  route({ body: CaseFormCreateRequest }, ({ user, body }) =>
    CaseFormController.create(user, body)
  )
);

CaseFormRouter.put(
  '/i/:id',
  route({ body: CaseFormUpdateRequest }, ({ user, params, body }) =>
    CaseFormController.update(user, params.id, body)
  )
);

CaseFormRouter.delete(
  '/i/:id',
  route(({ user, params }) =>
    CaseFormController.delete(user, params.id)
  )
);

export default CaseFormRouter;
