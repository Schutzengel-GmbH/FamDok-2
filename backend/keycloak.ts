import './loadEnv';
import KcAdminClient from '@keycloak/keycloak-admin-client';
import RealmRepresentation from '@keycloak/keycloak-admin-client/lib/defs/realmRepresentation';
import { readFileSync } from 'node:fs';
import {
  KC_ADMIN_CLIENT_ID,
  KC_ADMIN_CLIENT_SECRET,
  KC_ADMIN_PASSWORD,
  KC_ADMIN_USER,
  KC_BASE_URL,
  KC_REALM,
} from './config';
import { prisma } from './db';
import { Role } from '../shared/generated/prisma/client';

/** realm-management roles the backend's service account needs to manage users */
const SERVICE_ACCOUNT_ROLES = ['manage-users', 'view-users', 'query-users'];

function readRealm(): RealmRepresentation {
  const realm = JSON.parse(
    readFileSync('../shared/keycloak-config/realm-import.json', 'utf-8')
  ) as RealmRepresentation;

  // the import file has no secret (Keycloak generates a random one), so set the configured one
  const backendClient = realm.clients?.find(
    (c) => c.clientId === KC_ADMIN_CLIENT_ID
  );
  if (backendClient) backendClient.secret = KC_ADMIN_CLIENT_SECRET;

  return realm;
}

/**
 * Assigns the realm-management roles to the backend client's service account. Needed after the
 * client is recreated, since that also recreates its service-account user without any roles.
 */
async function ensureServiceAccountRoles(adminClient: KcAdminClient) {
  const backendClient = (
    await adminClient.clients.find({
      realm: KC_REALM,
      clientId: KC_ADMIN_CLIENT_ID,
    })
  )[0];
  const realmManagement = (
    await adminClient.clients.find({
      realm: KC_REALM,
      clientId: 'realm-management',
    })
  )[0];
  if (!backendClient?.id || !realmManagement?.id) {
    console.log('error finding service-account or realm-management client');
    return;
  }

  const serviceAccount = await adminClient.clients.getServiceAccountUser({
    realm: KC_REALM,
    id: backendClient.id,
  });
  const available = await adminClient.users.listAvailableClientRoleMappings({
    realm: KC_REALM,
    id: serviceAccount.id!,
    clientUniqueId: realmManagement.id,
  });
  const roles = available.filter((r) => SERVICE_ACCOUNT_ROLES.includes(r.name!));
  if (roles.length < 1) return;

  await adminClient.users.addClientRoleMappings({
    realm: KC_REALM,
    id: serviceAccount.id!,
    clientUniqueId: realmManagement.id,
    roles: roles.map((r) => ({ id: r.id!, name: r.name! })),
  });
}

/** Creates the app-side Admin user matching the realm's admin user, if missing. */
async function ensureAdminUser(adminClient: KcAdminClient) {
  const admins = await adminClient.users
    .find({
      email: 'admin@fh-realm.de',
      realm: KC_REALM,
    })
    .catch((e) => {
      console.log('error finding admin user');
      console.log(e);
    });
  if (!admins || admins.length < 1) {
    console.log('admin user not found, aborting...');
    return;
  }
  const admin = admins[0];

  const preAdmin = await prisma.user.findUnique({
    where: { kcId: admin.id },
  });

  if (!preAdmin) {
    await prisma.user.create({
      data: {
        email: admin.email!,
        kcId: admin.id!,
        role: Role.Admin,
      },
    });
  }
}

async function main() {
  const adminClient = new KcAdminClient({
    baseUrl: KC_BASE_URL,
  });
  await adminClient.auth({
    username: KC_ADMIN_USER,
    password: KC_ADMIN_PASSWORD,
    grantType: 'password',
    clientId: 'admin-cli',
  });

  const realm = readRealm();
  const pre = await adminClient.realms.findOne({ realm: KC_REALM });

  if (pre) {
    console.log('pre-existing realm, updating...');

    // update the top level realm attributes (this will not overwrite the clients, users, etc.)
    await adminClient.realms.update({ realm: KC_REALM }, realm);

    // update the clients by deleting the old ones and rewriting
    for (const client of realm.clients ?? []) {
      const id = (
        await adminClient.clients.find({
          realm: KC_REALM,
          clientId: client.clientId,
        })
      )[0]?.id;

      if (!id) {
        console.log(`error finding client ${client.clientId}, trying to create...`);
      } else {
        await adminClient.clients.del({ id, realm: KC_REALM });
      }

      await adminClient.clients.create({ realm: KC_REALM, ...client });
    }
  } else {
    console.log('creating realm...');

    const created = await adminClient.realms.create(realm).catch((e) => {
      console.log('Realm creation failed: ');
      console.log(e);
    });

    // creating a realm failed, abort
    if (!created) {
      console.log('aborted...');
      return;
    }
  }

  await ensureServiceAccountRoles(adminClient);
  await ensureAdminUser(adminClient);

  console.log('...done');
}

main();
