import KcAdminClient from '@keycloak/keycloak-admin-client';
import {
  KC_ADMIN_CLIENT_ID,
  KC_ADMIN_CLIENT_SECRET,
  KC_BASE_URL,
  KC_REALM,
} from './config';

const adminClient = new KcAdminClient({
  baseUrl: KC_BASE_URL,
  realmName: KC_REALM,
});

let pendingAuth: Promise<void> | undefined;

/**
 * Authenticates via the client credentials grant. Concurrent callers share one token request.
 * Client credentials tokens come without a refresh token, so expiry means re-authenticating.
 */
function authenticate() {
  pendingAuth ??= adminClient
    .auth({
      grantType: 'client_credentials',
      clientId: KC_ADMIN_CLIENT_ID,
      clientSecret: KC_ADMIN_CLIENT_SECRET,
    })
    .finally(() => (pendingAuth = undefined));
  return pendingAuth;
}

adminClient.registerTokenProvider({
  getAccessToken: async () => {
    if (!adminClient.accessToken || adminClient.isTokenExpired())
      await authenticate();
    return adminClient.accessToken;
  },
});

/**
 * Returns a keycloak admin client authenticated as the realm's service-account client.
 * Tokens are fetched lazily and only renewed once expired.
 * @returns AdminClient
 */
export default async function getAdminClient() {
  return adminClient;
}
