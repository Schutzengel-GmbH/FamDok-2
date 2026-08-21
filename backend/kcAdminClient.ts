import KcAdminClient from '@keycloak/keycloak-admin-client';
import { KC_ADMIN_PASSWORD, KC_ADMIN_USER, KC_BASE_URL } from './config';
import { GrantTypes } from '@keycloak/keycloak-admin-client/lib/utils/auth';

const adminClient = new KcAdminClient({
  baseUrl: KC_BASE_URL,
});

const credentials = {
  username: KC_ADMIN_USER,
  password: KC_ADMIN_PASSWORD,
  grantType: 'password' as GrantTypes,
  clientId: 'admin-cli',
};

/**
 * Returns an authenticated keycloak admin client
 * @returns AdminClient
 */
export default async function getAdminClient() {
  await adminClient.auth(credentials);
  return adminClient;
}
