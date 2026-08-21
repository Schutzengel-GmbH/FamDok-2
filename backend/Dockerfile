# =========================================
# Stage 1: Build the express Application
# =========================================
ARG NODE_VERSION=24.12.0-alpine

# Use a lightweight Node.js image for building (customizable via ARG)
FROM node:${NODE_VERSION} AS build

# Set the working directory inside the container
WORKDIR /app

# Copy package-related files first to leverage Docker's caching mechanism
COPY ./backend/package.json ./backend/package-lock.json ./

RUN --mount=type=bind,source=./backend/package.json,target=package.json \
  --mount=type=bind,source=./backend/package-lock.json,target=package-lock.json \
  --mount=type=cache,target=/root/.npm \
  npm ci


# Copy the rest of the application source code into the container. The whole shared/ directory
# is copied (matching frontend/Dockerfile) rather than an individual-file allowlist, so adding a
# new file under shared/ can't silently break this build the way shared/zodTypes.ts once did.
COPY ./backend ./src/backend
COPY ./shared ./src/shared

WORKDIR /app/src/backend

# `prisma generate` only reads schema.prisma - it needs no live DB connection -
# but prisma.config.ts's env('DATABASE_URL') throws if the var is entirely
# unset, which it always is at build time (no .env file is ever baked into
# the image, by design - see docker-compose.yaml's env_file/environment).
# A placeholder satisfies that check without needing real credentials here.
ARG DATABASE_URL=postgresql://user:password@localhost:5432/db
ENV DATABASE_URL=${DATABASE_URL}

RUN npx prisma generate

RUN npm run build


################################################################################
# Create a new stage to run the application with minimal runtime dependencies
# where the necessary files are copied from the build stage.
FROM build AS final

# Use production node environment by default.
ENV NODE_ENV production

# Create the uploads directory (mounted as a volume in docker-compose.yaml) and hand it to the
# non-root `node` user - otherwise a fresh volume mount is root-owned and writes fail.
RUN mkdir -p /app/dist/uploads && chown -R node:node /app/dist/uploads

# Run the application as a non-root user.
USER node

# Copy package.json so that package manager commands can be used.
COPY ./backend/package.json .

# Copy the production dependencies from the build stage and also
# the built application from the build stage into the image.
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/src/backend/dist /app/dist
COPY --from=build /app/src/shared/generated /app/dist/shared/generated
COPY --from=build /app/src/backend/prisma /app/dist/prisma
COPY --from=build /app/src/backend/prisma.config.ts /app/dist/prisma.config.ts
COPY --from=build /app/src/backend/loadEnv.ts /app/dist/loadEnv.ts

WORKDIR /app/dist

# Expose the port that the application listens on.
EXPOSE 3000

# Run the application.
CMD npx prisma migrate deploy && node ./backend/index.js
