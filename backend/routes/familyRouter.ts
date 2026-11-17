import { Router } from 'express';
import { FamilyController } from '../controller/familyController';
import { route } from '../util/routerUtils';
import { ChildHealthDataRequest, FamilyUpdateRequest } from '../../shared/api';

const FamilyRouter = Router();


FamilyRouter.get(
  '/i/:id',
  route(({ user, params }) =>
    FamilyController.get(user, params.id)
  )
);

FamilyRouter.get(
  '/i/:id/caregivers',
  route(({ user, params }) =>
    FamilyController.getCaregivers(user, params.id)
  )
);

FamilyRouter.get(
  '/i/:id/caregivers/:caregiverId',
  route(({ user, params }) =>
    FamilyController.getCaregiver(user, params.caregiverId)
  )
);

FamilyRouter.get(
  '/i/:id/children',
  route(({ user, params }) =>
    FamilyController.getChildren(user, params.id)
  )
);

FamilyRouter.get(
  '/i/:id/children/:childId',
  route(({ user, params }) =>
    FamilyController.getChild(user, params.childId)
  )
);


FamilyRouter.put(
  '/i/:id',
  route({ body: FamilyUpdateRequest }, ({ user, params, body }) =>
    FamilyController.update(user, params.id, body)
  )
);

FamilyRouter.put(
  '/i/:id/children/:childId/health-data',
  route({ body: ChildHealthDataRequest }, ({ user, params, body }) =>
    FamilyController.updateChildHealthData(
      user,
      params.id,
      params.childId,
      body
    )
  )
);

FamilyRouter.delete(
  '/i/:id',
  route(({ user, params }) =>
    FamilyController.delete(user, params.id)
  )
);

FamilyRouter.get(
  '/my',
  route(({ user }) =>
    FamilyController.getWhere(user, { case: { responsibleUsers: { some: { id: user.id } } }, })
  )
);

FamilyRouter.get(
  '/stats',
  route(({ user }) =>
    FamilyController.getStats()
  )
);

FamilyRouter.get(
  '/stats/my',
  route(({ user }) =>
    FamilyController.getStats({ case: { responsibleUsers: { some: { id: user.id } } }, })
  )
);

export default FamilyRouter;
