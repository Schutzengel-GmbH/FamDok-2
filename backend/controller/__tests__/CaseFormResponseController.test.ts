jest.mock('../../db', () => ({ prisma: require('../../testUtils/prismaMock').createPrismaMock() }));

import { prisma } from '../../db';
import { createPrismaMock } from '../../testUtils/prismaMock';
import {
  buildCase,
  buildCaseForm,
  buildCaseFormResponse,
  buildUser,
} from '../../testUtils/fixtures';
import { CaseFormResponseController } from '../CaseFormResponseController';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../util/authUtils';
import { Role } from '../../../shared/generated/prisma/client';

const prismaMock = prisma as unknown as ReturnType<typeof createPrismaMock>;

describe('CaseFormResponseController', () => {
  describe('getAll', () => {
    it('returns all responses for Admin', async () => {
      const admin = buildUser({ role: Role.Admin });
      const responses = [buildCaseFormResponse()];
      prismaMock.caseFormResponse.findMany.mockResolvedValue(responses);

      const result = await CaseFormResponseController.getAll(admin);

      expect(result).toBe(responses);
    });

    it('throws ForbiddenError for non-admins', async () => {
      const user = buildUser({ role: Role.OrgController });

      await expect(CaseFormResponseController.getAll(user)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('getWhere', () => {
    it('returns responses the user can see', async () => {
      const user = buildUser({ role: Role.User });
      const c = buildCase({ responsibleUsers: [{ id: user.id }] });
      const responses = [buildCaseFormResponse({ case: c })];
      prismaMock.caseFormResponse.findMany.mockResolvedValue(responses);

      const result = await CaseFormResponseController.getWhere(user, {} as any);

      expect(result).toBe(responses);
    });

    it('throws ForbiddenError when user cannot see some responses', async () => {
      const user = buildUser({ role: Role.User });
      const c = buildCase({ responsibleUsers: [{ id: 'someone-else' }] });
      const responses = [buildCaseFormResponse({ case: c })];
      prismaMock.caseFormResponse.findMany.mockResolvedValue(responses);

      await expect(CaseFormResponseController.getWhere(user, {} as any)).rejects.toThrow(
        ForbiddenError
      );
    });
  });

  describe('get', () => {
    it('returns the response when visible to the user', async () => {
      const user = buildUser({ role: Role.Admin });
      const response = buildCaseFormResponse();
      prismaMock.caseFormResponse.findUnique.mockResolvedValue(response);

      const result = await CaseFormResponseController.get(user, response.id);

      expect(result).toBe(response);
    });

    it('throws NotFoundError when missing', async () => {
      const user = buildUser({ role: Role.Admin });
      prismaMock.caseFormResponse.findUnique.mockResolvedValue(null);

      await expect(CaseFormResponseController.get(user, 'missing')).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when the user cannot see the response', async () => {
      const user = buildUser({ role: Role.User });
      const c = buildCase({ responsibleUsers: [{ id: 'someone-else' }] });
      const response = buildCaseFormResponse({ case: c });
      prismaMock.caseFormResponse.findUnique.mockResolvedValue(response);

      await expect(CaseFormResponseController.get(user, response.id)).rejects.toThrow(
        ForbiddenError
      );
    });
  });

  describe('create', () => {
    function buildCreateData(caseId: string, caseFormId: string, answers: any[] = []) {
      return {
        case: { connect: { id: caseId } },
        caseForm: { connect: { id: caseFormId } },
        answers: { createMany: { data: answers } },
      } as any;
    }

    it('creates a response, filling in missing answers for each question', async () => {
      const user = buildUser({ role: Role.User });
      const c = buildCase({ responsibleUsers: [{ id: user.id }] });
      prismaMock.case.findUnique.mockResolvedValue(c);

      const definition = buildCaseForm({
        type: 'multiple',
        questions: [{ id: 'q1' }, { id: 'q2' }],
      });
      prismaMock.caseForm.findUnique.mockResolvedValue(definition);

      const created = buildCaseFormResponse();
      prismaMock.caseFormResponse.create.mockResolvedValue(created);

      const data = buildCreateData(c.id, definition.id, [
        { questionId: 'q1', answerText: 'hello' },
      ]);

      const result = await CaseFormResponseController.create(user, data);

      expect(result).toBe(created);
      const createCall = prismaMock.caseFormResponse.create.mock.calls[0][0];
      expect(createCall.data.answers.createMany.data).toEqual([
        { questionId: 'q1', answerText: 'hello' },
        { questionId: 'q2' },
      ]);
    });

    it('allows a single-type response when none exists yet', async () => {
      const user = buildUser({ role: Role.User });
      const c = buildCase({ responsibleUsers: [{ id: user.id }] });
      prismaMock.case.findUnique.mockResolvedValue(c);

      const definition = buildCaseForm({ type: 'single', questions: [] });
      prismaMock.caseForm.findUnique.mockResolvedValue(definition);
      prismaMock.caseFormResponse.count.mockResolvedValue(0);

      const created = buildCaseFormResponse();
      prismaMock.caseFormResponse.create.mockResolvedValue(created);

      const data = buildCreateData(c.id, definition.id, []);

      const result = await CaseFormResponseController.create(user, data);

      expect(result).toBe(created);
    });

    it('rejects a second response for a single-type definition', async () => {
      const user = buildUser({ role: Role.User });
      const c = buildCase({ responsibleUsers: [{ id: user.id }] });
      prismaMock.case.findUnique.mockResolvedValue(c);

      const definition = buildCaseForm({ type: 'single', questions: [] });
      prismaMock.caseForm.findUnique.mockResolvedValue(definition);
      prismaMock.caseFormResponse.count.mockResolvedValue(1);

      const data = buildCreateData(c.id, definition.id, []);

      await expect(CaseFormResponseController.create(user, data)).rejects.toThrow(BadRequestError);
      expect(prismaMock.caseFormResponse.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestError when no definition id is provided', async () => {
      const user = buildUser({ role: Role.User });
      const c = buildCase({ responsibleUsers: [{ id: user.id }] });
      prismaMock.case.findUnique.mockResolvedValue(c);

      const data = {
        case: { connect: { id: c.id } },
        answers: { createMany: { data: [] } },
      } as any;

      await expect(CaseFormResponseController.create(user, data)).rejects.toThrow(BadRequestError);
    });

    it('throws ForbiddenError when the user is not responsible for the case', async () => {
      const user = buildUser({ role: Role.User });
      const c = buildCase({ responsibleUsers: [{ id: 'someone-else' }] });
      prismaMock.case.findUnique.mockResolvedValue(c);

      const data = buildCreateData(c.id, 'form-1', []);

      await expect(CaseFormResponseController.create(user, data)).rejects.toThrow(ForbiddenError);
      expect(prismaMock.caseFormResponse.create).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError when the case does not exist', async () => {
      const user = buildUser({ role: Role.User });
      prismaMock.case.findUnique.mockResolvedValue(null);

      const data = buildCreateData('missing-case', 'form-1', []);

      await expect(CaseFormResponseController.create(user, data)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('update', () => {
    it('updates the response when the user is authorized', async () => {
      const user = buildUser({ role: Role.Admin });
      const existing = buildCaseFormResponse();
      prismaMock.caseFormResponse.findUnique.mockResolvedValue(existing);
      const updated = { ...existing };
      prismaMock.caseFormResponse.update.mockResolvedValue(updated);

      const result = await CaseFormResponseController.update(user, existing.id, {} as any);

      expect(result).toBe(updated);
    });

    it('throws NotFoundError when missing', async () => {
      const user = buildUser({ role: Role.Admin });
      prismaMock.caseFormResponse.findUnique.mockResolvedValue(null);

      await expect(
        CaseFormResponseController.update(user, 'missing', {} as any)
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when the user cannot edit the response', async () => {
      const user = buildUser({ role: Role.User });
      const c = buildCase({ responsibleUsers: [{ id: 'someone-else' }] });
      const existing = buildCaseFormResponse({ case: c });
      prismaMock.caseFormResponse.findUnique.mockResolvedValue(existing);

      await expect(
        CaseFormResponseController.update(user, existing.id, {} as any)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('delete', () => {
    it('deletes the response when authorized', async () => {
      const user = buildUser({ role: Role.Admin });
      const existing = buildCaseFormResponse();
      prismaMock.caseFormResponse.findFirst.mockResolvedValue(existing);
      prismaMock.caseFormResponse.delete.mockResolvedValue(existing);

      const result = await CaseFormResponseController.delete(user, existing.id);

      expect(result).toBe(existing);
    });

    it('throws NotFoundError when missing', async () => {
      const user = buildUser({ role: Role.Admin });
      prismaMock.caseFormResponse.findFirst.mockResolvedValue(null);

      await expect(CaseFormResponseController.delete(user, 'missing')).rejects.toThrow(
        NotFoundError
      );
    });

    it('throws ForbiddenError when the user cannot edit the response', async () => {
      const user = buildUser({ role: Role.User });
      const c = buildCase({ responsibleUsers: [{ id: 'someone-else' }] });
      const existing = buildCaseFormResponse({ case: c });
      prismaMock.caseFormResponse.findFirst.mockResolvedValue(existing);

      await expect(CaseFormResponseController.delete(user, existing.id)).rejects.toThrow(
        ForbiddenError
      );
      expect(prismaMock.caseFormResponse.delete).not.toHaveBeenCalled();
    });
  });
});
