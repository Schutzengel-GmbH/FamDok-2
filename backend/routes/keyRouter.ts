import express, { Router } from 'express';
import { handleError, rawRoute, route } from '../util/routerUtils';
import { KeyController } from '../controller/KeyController';
import {
  AttachmentContentQuery,
  GrantRequest,
  OrgSetupRequest,
  PassphraseChangeRequest,
  ReencryptRowsQuery,
  ReencryptRowsRequest,
  RotationCompleteRequest,
  RotationStartRequest,
  UserKeyRequest,
} from '../../shared/api';
import { MAX_UPLOAD_SIZE_MB } from '../config';
import { ReencryptMode } from '../util/encryptedRows';

/**
 * `/keys`: the org encryption's key management. Not behind the frozen-org check, since a
 * rotation runs while the org is frozen.
 */
export const KeyRouter = Router();

KeyRouter.get(
  '/me',
  route(({ user }) => KeyController.getStatus(user))
);

KeyRouter.put(
  '/me',
  route({ body: UserKeyRequest }, ({ user, body }) =>
    KeyController.enrol(user, body)
  )
);

KeyRouter.put(
  '/me/passphrase',
  route({ body: PassphraseChangeRequest }, ({ user, body }) =>
    KeyController.changePassphrase(user, body)
  )
);

KeyRouter.post(
  '/orgs/:orgId/setup',
  route({ body: OrgSetupRequest }, ({ user, params, body }) =>
    KeyController.setupOrg(user, params.orgId, body)
  )
);

KeyRouter.get(
  '/orgs/:orgId/members',
  route(({ user, params }) => KeyController.getMembers(user, params.orgId))
);

KeyRouter.post(
  '/orgs/:orgId/grants',
  route({ body: GrantRequest }, ({ user, params, body }) =>
    KeyController.grant(user, params.orgId, body)
  )
);

KeyRouter.delete(
  '/orgs/:orgId/grants/:userId',
  route(({ user, params }) =>
    KeyController.revoke(user, params.orgId, params.userId)
  )
);

KeyRouter.get(
  '/orgs/:orgId/events',
  route(({ user, params }) => KeyController.getEvents(user, params.orgId))
);

KeyRouter.get(
  '/orgs/:orgId/recovery',
  route(({ user, params }) => KeyController.getRecovery(user, params.orgId))
);

KeyRouter.post(
  '/orgs/:orgId/freeze',
  route(({ user, params }) => KeyController.freeze(user, params.orgId))
);

KeyRouter.post(
  '/orgs/:orgId/unfreeze',
  route(({ user, params }) => KeyController.unfreeze(user, params.orgId))
);

KeyRouter.post(
  '/orgs/:orgId/rotation/start',
  route({ body: RotationStartRequest }, ({ user, params, body }) =>
    KeyController.startRotation(user, params.orgId, body)
  )
);

KeyRouter.post(
  '/orgs/:orgId/rotation/complete',
  route({ body: RotationCompleteRequest }, ({ user, params, body }) =>
    KeyController.completeRotation(user, params.orgId, body)
  )
);

const rawContent = express.raw({
  type: 'application/octet-stream',
  limit: `${MAX_UPLOAD_SIZE_MB + 1}mb`,
});

/** The bulk-job routes exist once per job: `/rotation/...` and `/migration/...`. */
for (const mode of ['rotation', 'migration'] as ReencryptMode[]) {
  KeyRouter.get(
    `/orgs/:orgId/${mode}/status`,
    route(({ user, params }) =>
      KeyController.getJobStatus(user, params.orgId, mode)
    )
  );

  KeyRouter.get(
    `/orgs/:orgId/${mode}/rows`,
    route({ query: ReencryptRowsQuery }, ({ user, params, query }) =>
      KeyController.getJobRows(user, params.orgId, mode, query)
    )
  );

  KeyRouter.put(
    `/orgs/:orgId/${mode}/rows`,
    route({ body: ReencryptRowsRequest }, ({ user, params, body }) =>
      KeyController.putJobRows(user, params.orgId, mode, body)
    )
  );

  KeyRouter.get(
    `/orgs/:orgId/${mode}/attachments`,
    route(({ user, params }) =>
      KeyController.getJobAttachments(user, params.orgId, mode)
    )
  );

  KeyRouter.get(
    `/orgs/:orgId/${mode}/attachments/:id/content`,
    async (req, res) => {
      try {
        const path = await KeyController.getJobAttachmentPath(
          req.user!,
          req.params['orgId'] as string,
          mode,
          req.params['id'] as string
        );
        res.contentType('application/octet-stream');
        res.sendFile(path);
      } catch (e) {
        handleError(e, res);
      }
    }
  );

  KeyRouter.put(
    `/orgs/:orgId/${mode}/attachments/:id/content`,
    rawContent,
    rawRoute({ query: AttachmentContentQuery }, async ({ user, params, query, body, res }) => {
      await KeyController.putJobAttachmentContent(user, params.orgId, mode, params.id, query, body);
      res.status(204).send();
    })
  );
}
