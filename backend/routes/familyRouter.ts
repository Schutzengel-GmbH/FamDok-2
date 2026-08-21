import { Router } from 'express';
import { FamilyController } from '../controller/familyController';
import { handleError } from '../util/routerUtils';
import { Prisma } from '../../shared/generated/prisma/client';

const FamilyRouter = Router();

FamilyRouter.get('/', async (req, res) => {
  const where = req.query['where']
    ? (JSON.parse(req.query['where'] as string) as Prisma.FamilyWhereInput)
    : undefined;
  try {
    const families = await FamilyController.getWhere(req.user!, where);
    res.send(families);
  } catch (e) {
    handleError(e, res);
  }
});

FamilyRouter.get('/i/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const family = await FamilyController.get(req.user!, id);
    res.send(family);
  } catch (e) {
    handleError(e, res);
  }
});

FamilyRouter.get('/i/:id/caregivers', async (req, res) => {
  const { id } = req.params;
  try {
    const caregivers = await FamilyController.getCaregivers(req.user!, id);
    res.send(caregivers);
  } catch (e) {
    handleError(e, res);
  }
});

FamilyRouter.get('/i/:id/caregivers/:caregiverId', async (req, res) => {
  const { id, caregiverId } = req.params;
  try {
    const caregiver = await FamilyController.getCaregiver(
      req.user!,
      caregiverId
    );
    res.send(caregiver);
  } catch (e) {
    handleError(e, res);
  }
});

FamilyRouter.get('/i/:id/children', async (req, res) => {
  const { id } = req.params;
  try {
    const children = await FamilyController.getChildren(req.user!, id);
    res.send(children);
  } catch (e) {
    handleError(e, res);
  }
});

FamilyRouter.get('/i/:id/children/:childId', async (req, res) => {
  const { id, childId } = req.params;
  try {
    const caregiver = await FamilyController.getChild(req.user!, childId);
    res.send(caregiver);
  } catch (e) {
    handleError(e, res);
  }
});

FamilyRouter.post('/', async (req, res) => {
  const familyInput = req.body as Prisma.FamilyCreateInput;
  try {
    const family = await FamilyController.create(req.user!, familyInput);
    res.send(family);
  } catch (e) {
    handleError(e, res);
  }
});

FamilyRouter.put('/i/:id', async (req, res) => {
  const { id } = req.params;
  const updateInput = req.body as Prisma.FamilyUpdateInput;
  try {
    const family = await FamilyController.update(req.user!, id, updateInput);
    res.send(family);
  } catch (e) {
    handleError(e, res);
  }
});

FamilyRouter.delete('/i/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const family = await FamilyController.delete(req.user!, id);
    res.send(family);
  } catch (e) {
    handleError(e, res);
  }
});

FamilyRouter.get('/my', async (req, res) => {
  try {
    const families = await FamilyController.getWhere(req.user!, {
      case: { responsibleUsers: { some: { id: req.user!.id } } },
    });

    res.send(families);
  } catch (e) {
    handleError(e, res);
  }
});

FamilyRouter.get('/stats', async (req, res) => {
  const families = await FamilyController.getStats();
  res.send(families);
});

FamilyRouter.get('/stats/my', async (req, res) => {
  const families = await FamilyController.getStats({
    case: { responsibleUsers: { some: { id: req.user!.id } } },
  });

  res.send(families);
});

export default FamilyRouter;
