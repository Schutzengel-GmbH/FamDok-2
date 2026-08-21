import './loadEnv';
import KcAdminClient from '@keycloak/keycloak-admin-client';
import RealmRepresentation from '@keycloak/keycloak-admin-client/lib/defs/realmRepresentation';
import { readFileSync } from 'node:fs';
import {
  KC_ADMIN_PASSWORD,
  KC_ADMIN_USER,
  KC_BASE_URL,
  KC_CLIENT,
  KC_REALM,
} from './config';
import { prisma } from './db';
import { Role } from '../shared/generated/prisma/client';

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

  const pre = await adminClient.realms.findOne({ realm: KC_REALM });

  if (pre) {
    console.log('pre-existing realm, updating...');

    // update the top level realm attributes (this will not overwrite the clients, users, etc.)
    await adminClient.realms.update(
      { realm: KC_REALM },
      JSON.parse(
        readFileSync('../shared/keycloak-config/realm-import.json', 'utf-8')
      )
    );

    // update the client by deleting the old one and rewriting
    const clientId = (
      await adminClient.clients.find({ realm: KC_REALM, clientId: KC_CLIENT })
    )[0].id;

    if (!clientId) {
      console.log('error finding client, trying to create...');
    } else {
      await adminClient.clients.del({ id: clientId, realm: KC_REALM });
    }

    await adminClient.clients.create({
      realm: KC_REALM,
      ...(JSON.parse(
        readFileSync('../shared/keycloak-config/realm-import.json', 'utf-8')
      ) as RealmRepresentation)!.clients![0],
    });

    // create an admin user in the database
    const admin = (
      await adminClient.users.find({
        email: 'admin@fh-realm.de',
        realm: KC_REALM,
      })
    )[0];

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
  } else {
    console.log('creating realm...');

    await adminClient.realms
      .create(
        JSON.parse(
          readFileSync('../shared/keycloak-config/realm-import.json', 'utf-8')
        )
      )
      .catch((e) => console.log(e));

    // create an admin user in the database
    const admin = (
      await adminClient.users.find({
        email: 'admin@fh-realm.de',
        realm: KC_REALM,
      })
    )[0];

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

  console.log('...done');
}

main();
