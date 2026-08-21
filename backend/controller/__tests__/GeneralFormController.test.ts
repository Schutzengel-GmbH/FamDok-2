jest.mock('../../db', () => ({ prisma: require('../../testUtils/prismaMock').createPrismaMock() }));

import { prisma } from '../../db';
import { createPrismaMock } from '../../testUtils/prismaMock';
import {
  buildGeneralForm,
  buildGeneralFormResponse,
  buildUser,
} from '../../testUtils/fixtures';
import { GeneralFormController } from '../GeneralFormController';
import { ForbiddenError, NotFoundError } from '../../util/authUtils';
import { Role } from '../../../shared/generated/prisma/client';

const prismaMock = prisma as unknown as ReturnType<typeof createPrismaMock>;

describe('GeneralFormController', () => {
  describe('getDefinitions / getDefinition', () => {
    it('returns all form definitions', async () => {
      const user = buildUser({ role: Role.Admin });
      const forms = [buildGeneralForm()];
      prismaMock.generalForm.findMany.mockResolvedValue(forms);

      const result = await GeneralFormController.getDefinitions(user);

      expect(result).toBe(forms);
    });

    it('returns a single form definition', async () => {
      const user = buildUser({ role: Role.Admin });
      const form = buildGeneralForm();
      prismaMock.generalForm.findFirst.mockResolvedValue(form);

      const result = await GeneralFormController.getDefinition(user, form.id);

      expect(result).toBe(form);
    });
  });

  describe('createDefinition', () => {
    it('creates a definition for privileged users', async () => {
      const admin = buildUser({ role: Role.Admin });
      const created = buildGeneralForm();
      prismaMock.generalForm.create.mockResolvedValue(created);

      const result = await GeneralFormController.createDefinition(admin, { name: 'Form' } as any);

      expect(result).toBe(created);
    });

    it('throws ForbiddenError for a plain user', () => {
      const user = buildUser({ role: Role.User });

      expect(() =>
        GeneralFormController.createDefinition(user, { name: 'Form' } as any)
      ).toThrow(ForbiddenError);
    });
  });

  describe('updateDefinition / deleteDefinition', () => {
    it('updates a definition for privileged users', async () => {
      const admin = buildUser({ role: Role.Controller });
      const existing = buildGeneralForm();
      prismaMock.generalForm.findUnique.mockResolvedValue(existing);
      const updated = buildGeneralForm();
      prismaMock.generalForm.update.mockResolvedValue(updated);

      const result = await GeneralFormController.updateDefinition(admin, existing.id, {
        name: 'Renamed',
      } as any);

      expect(result).toBe(updated);
    });

    it('throws ForbiddenError updating as a plain user', async () => {
      const user = buildUser({ role: Role.User });
      prismaMock.generalForm.findUnique.mockResolvedValue(buildGeneralForm());

      await expect(
        GeneralFormController.updateDefinition(user, 'form-1', { name: 'Renamed' } as any)
      ).rejects.toThrow(ForbiddenError);
    });

    it('deletes a definition for privileged users', async () => {
      const admin = buildUser({ role: Role.OrgController });
      const existing = buildGeneralForm({ organisationId: admin.organisationId });
      prismaMock.generalForm.findUnique.mockResolvedValue(existing);
      const deleted = buildGeneralForm();
      prismaMock.generalForm.delete.mockResolvedValue(deleted);

      const result = await GeneralFormController.deleteDefinition(admin, existing.id);

      expect(result).toBe(deleted);
    });

    it('throws ForbiddenError deleting as a plain user', async () => {
      const user = buildUser({ role: Role.User });
      prismaMock.generalForm.findUnique.mockResolvedValue(buildGeneralForm());

      await expect(GeneralFormController.deleteDefinition(user, 'form-1')).rejects.toThrow(
        ForbiddenError
      );
    });
  });

  describe('getResponses / getResponse', () => {
    it('returns responses matching a filter', async () => {
      const user = buildUser();
      const responses = [buildGeneralFormResponse({ createdBy: { id: user.id } })];
      prismaMock.generalFormResponse.findMany.mockResolvedValue(responses);

      const result = await GeneralFormController.getResponses(user, {} as any);

      expect(result).toBe(responses);
    });

    it('returns a single response', async () => {
      const user = buildUser();
      const response = buildGeneralFormResponse({ createdBy: { id: user.id } });
      prismaMock.generalFormResponse.findUnique.mockResolvedValue(response);

      const result = await GeneralFormController.getResponse(user, response.id);

      expect(result).toBe(response);
    });

    it('throws NotFoundError when the response is missing', async () => {
      const user = buildUser();
      prismaMock.generalFormResponse.findUnique.mockResolvedValue(null);

      await expect(GeneralFormController.getResponse(user, 'missing')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('createResponse', () => {
    it('fills in missing answers for each question and attaches the creator', async () => {
      const user = buildUser();
      const definition = buildGeneralForm({ questions: [{ id: 'q1' }, { id: 'q2' }] });
      prismaMock.generalForm.findUniqueOrThrow.mockResolvedValue(definition);

      const created = buildGeneralFormResponse();
      prismaMock.generalFormResponse.create.mockResolvedValue(created);

      const data = {
        form: { connect: { id: definition.id } },
        answers: { createMany: { data: [{ questionId: 'q1', answerText: 'hi' }] } },
      } as any;

      const result = await GeneralFormController.createResponse(user, data);

      expect(result).toBe(created);
      const createCall = prismaMock.generalFormResponse.create.mock.calls[0][0];
      expect(createCall.data.answers.createMany.data).toEqual([
        { questionId: 'q1', answerText: 'hi' },
        { questionId: 'q2' },
      ]);
      expect(createCall.data.createdBy).toEqual({ connect: { id: user.id } });
    });
  });

  describe('updateResponse', () => {
    it('updates the response', async () => {
      const user = buildUser();
      const existing = buildGeneralFormResponse({ createdBy: { id: user.id } });
      prismaMock.generalFormResponse.findUnique.mockResolvedValue(existing);
      const updated = { ...existing };
      prismaMock.generalFormResponse.update.mockResolvedValue(updated);

      const result = await GeneralFormController.updateResponse(user, existing.id, {} as any);

      expect(result).toBe(updated);
    });

    it('throws NotFoundError when missing', async () => {
      const user = buildUser();
      prismaMock.generalFormResponse.findUnique.mockResolvedValue(null);

      await expect(
        GeneralFormController.updateResponse(user, 'missing', {} as any)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteResponse', () => {
    it('deletes the response', async () => {
      const user = buildUser();
      const existing = buildGeneralFormResponse({ createdBy: { id: user.id } });
      prismaMock.generalFormResponse.findUnique.mockResolvedValue(existing);
      prismaMock.generalFormResponse.delete.mockResolvedValue(existing);

      const result = await GeneralFormController.deleteResponse(user, existing.id);

      expect(result).toBe(existing);
    });

    it('throws NotFoundError when missing', async () => {
      const user = buildUser();
      prismaMock.generalFormResponse.findUnique.mockResolvedValue(null);

      await expect(GeneralFormController.deleteResponse(user, 'missing')).rejects.toThrow(
        NotFoundError
      );
    });
  });
});
