import './loadEnv';
import path from 'path';

/**
 * Base URL for the Keycloak server, default postgresql://${DATABASE_USER}:${DATABASE_PW}@localhost:5432/db
 */
export const DATABASE_URL: string =
  process.env['DATABASE_URL'] ??
  'postgresql://postgres:postgres@localhost:5432/db';

/**
 * Base URL for the Keycloak server, default 'http://localhost:8080'
 */
export const KC_BASE_URL: string =
  process.env['KC_BASE_URL'] ?? 'http://localhost:8080';

/**
 * Base URL for the Backend server, default 'http://localhost:3000'
 */
export const API_BASE_URL: string =
  process.env['API_BASE_URL'] ?? 'http://localhost:3000';

/**
 * Base URL for the frontend, default 'http://localhost:4200'
 */
export const FRONTEND_BASE_URL: string =
  process.env['FRONTEND_BASE_URL'] ?? 'http://localhost:4200';

/**
 * Name for the Keycloak realm, default 'fh-realm'
 */
export const KC_REALM: string = process.env['KC_REALM'] ?? 'fh-realm';

/**
 * Name for the Keycloak client, default 'fh-app'
 */
export const KC_CLIENT: string = process.env['KC_CLIENT'] ?? 'fh-app';

/**
 * Keycloak admin username, default 'admin'
 */
export const KC_ADMIN_USER: string = process.env['KC_ADMIN_USER'] ?? 'admin';

/**
 * Password for the Keycloak admin user, default 'admin'
 */
export const KC_ADMIN_PASSWORD: string =
  process.env['KC_ADMIN_PASSWORD'] ?? 'admin';

/**
 * Is Production Environment, default false
 */
export const PRODUCTION: boolean =
  (process.env['PRODUCTION']?.toLowerCase() === 'true' ||
    process.env['PRODUCTION'] === '1') ??
  false;

/**
 * Directory where uploaded files (document library + case attachments) are stored on disk,
 * default '<backend>/uploads'
 */
export const UPLOAD_DIR: string =
  process.env['UPLOAD_DIR'] ?? path.resolve(__dirname, 'uploads');

/**
 * Maximum allowed size in MB for a single uploaded file, default 25
 */
export const MAX_UPLOAD_SIZE_MB: number = Number(
  process.env['MAX_UPLOAD_SIZE_MB'] ?? 25
);
