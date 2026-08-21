cd backend
npx prisma migrate reset && npm run generate:keycloak && npm run seed:dev

