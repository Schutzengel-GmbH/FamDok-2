import { discovery, fetchUserInfo, allowInsecureRequests } from 'openid-client';
import { Strategy } from 'passport-http-bearer';
import { KC_BASE_URL, KC_CLIENT, KC_REALM, PRODUCTION } from '../config';
import { UserController } from '../controller/UserController';
import { FullUser } from '../../shared/types';
import { Role } from '../../shared/generated/prisma/client';
import { jwtDecode, JwtPayload } from 'jwt-decode';
import { isAfter } from 'date-fns';

declare global {
  namespace Express {
    interface User extends FullUser {}
  }
}

export const bearerStrategy = new Strategy(async (token, done) => {
  const serverURL = new URL(
    `/realms/${KC_REALM}/.well-known/openid-configuration`,
    KC_BASE_URL
  );

  let tokenDecoded: JwtPayload;

  try {
    tokenDecoded = jwtDecode(token);
  } catch (e) {
    return done(e);
  }

  if (!tokenDecoded.sub || !tokenDecoded.exp) return done('invalid token');
  const expiresAt = new Date(tokenDecoded.exp! * 1000 || 0);

  if (isAfter(new Date(), expiresAt)) return done('expired');

  const oauth2ServerConfig = await discovery(
    serverURL,
    KC_CLIENT,
    undefined,
    undefined,
    PRODUCTION ? undefined : { execute: [allowInsecureRequests] }
  );

  fetchUserInfo(oauth2ServerConfig, token, tokenDecoded.sub!)
    .then(async (userInfo) => {
      const user = await UserController.getUserByKC(userInfo.sub);
      if (user) return done(null, user);

      // Keycloak accounts not created through the app get a plain user on first login
      const newUser = await UserController.register({
        kcId: userInfo.sub,
        email: userInfo.email!,
        firstName: userInfo.given_name,
        lastName: userInfo.family_name,
        role: Role.User,
      });
      done(null, newUser);
    })
    .catch((error) => done(error));
});
