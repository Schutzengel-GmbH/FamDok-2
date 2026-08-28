import './loadEnv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../shared/generated/prisma/client';
import { DATABASE_URL } from './config';

const adapter = new PrismaPg({
  connectionString: DATABASE_URL,
});
export const prisma = new PrismaClient({ adapter });
