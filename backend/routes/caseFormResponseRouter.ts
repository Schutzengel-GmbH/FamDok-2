import { Router } from 'express';
import { CaseFormResponseController } from '../controller/CaseFormResponseController';
import { route } from '../util/routerUtils';
import {
  CaseFormResponseCreateRequest,
  CaseFormResponseListQuery,
  CaseFormResponseUpdateRequest,
} from '../../shared/api';

const CaseFormResponseRouter = Router();

CaseFormResponseRouter.get(
  '/',
  route({ query: CaseFormResponseListQuery }, ({ user, query }) =>
    CaseFormResponseController.getWhere(user, query.where)
  )
);

CaseFormResponseRouter.get(
  '/i/:id',
  route(({ user, params }) =>
    CaseFormResponseController.get(user, params.id)
  )
);

CaseFormResponseRouter.post(
  '/',
  route({ body: CaseFormResponseCreateRequest }, ({ user, body }) =>
    CaseFormResponseController.create(user, body)
  )
);

CaseFormResponseRouter.put(
  '/i/:id',
  route({ body: CaseFormResponseUpdateRequest }, ({ user, params, body }) =>
    CaseFormResponseController.update(user, params.id, body)
  )
);

CaseFormResponseRouter.delete(
  '/i/:id',
  route(({ user, params }) =>
    CaseFormResponseController.delete(user, params.id)
  )
);

export default CaseFormResponseRouter;
