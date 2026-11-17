import { Router } from 'express';
import { GeneralFormController } from '../controller/GeneralFormController';
import { route } from '../util/routerUtils';
import {
  GeneralFormCreateRequest,
  GeneralFormListQuery,
  GeneralFormResponseCreateRequest,
  GeneralFormResponseListQuery,
  GeneralFormResponseUpdateRequest,
  GeneralFormUpdateRequest,
} from '../../shared/api';

const GeneralFormRouter = Router();

GeneralFormRouter.get(
  '/definitions',
  route({ query: GeneralFormListQuery }, ({ user, query }) =>
    GeneralFormController.getDefinitions(user, query.where)
  )
);

GeneralFormRouter.get(
  '/definitions/i/:id',
  route(({ user, params }) =>
    GeneralFormController.getDefinition(user, params.id)
  )
);

GeneralFormRouter.post(
  '/definitions',
  route({ body: GeneralFormCreateRequest }, ({ user, body }) =>
    GeneralFormController.createDefinition(user, body)
  )
);

GeneralFormRouter.put(
  '/definitions/i/:id',
  route({ body: GeneralFormUpdateRequest }, ({ user, params, body }) =>
    GeneralFormController.updateDefinition(user, params.id, body)
  )
);

GeneralFormRouter.delete(
  '/definitions/i/:id',
  route(({ user, params }) =>
    GeneralFormController.deleteDefinition(user, params.id)
  )
);

GeneralFormRouter.get(
  '/responses',
  route({ query: GeneralFormResponseListQuery }, ({ user, query }) =>
    GeneralFormController.getResponses(user, query.where)
  )
);

GeneralFormRouter.get(
  '/responses/i/:id',
  route(({ user, params }) =>
    GeneralFormController.getResponse(user, params.id)
  )
);

GeneralFormRouter.post(
  '/responses',
  route({ body: GeneralFormResponseCreateRequest }, ({ user, body }) =>
    GeneralFormController.createResponse(user, body)
  )
);
GeneralFormRouter.put(
  '/responses/i/:id',
  route({ body: GeneralFormResponseUpdateRequest }, ({ user, params, body }) =>
    GeneralFormController.updateResponse(user, params.id, body)
  )
);

GeneralFormRouter.delete(
  '/responses/i/:id',
  route(({ user, params }) =>
    GeneralFormController.deleteResponse(user, params.id)
  )
);

export default GeneralFormRouter;
