# =========================================
# Stage 1: Build the Angular Application
# =========================================
ARG NODE_VERSION=24.12.0-alpine
ARG NGINX_VERSION=alpine3.22

# Use a lightweight Node.js image for building (customizable via ARG)
FROM node:${NODE_VERSION} AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy package-related files first to leverage Docker's caching mechanism
COPY ./frontend/package.json ./frontend/package-lock.json ./

RUN --mount=type=bind,source=./frontend/package.json,target=package.json \
    --mount=type=bind,source=./frontend/package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci


# Copy the rest of the application source code into the container
COPY ./frontend ./src/frontend
COPY ./shared ./src/shared

WORKDIR /app/src/frontend

# Build the Angular application
RUN npm run build

# =========================================
# Stage 2: Prepare Nginx to Serve Static Files
# =========================================

FROM nginxinc/nginx-unprivileged:${NGINX_VERSION} AS runner

# Copy custom Nginx config
COPY ./frontend/nginx.conf /etc/nginx/nginx.conf

# Copy the static build output from the build stage to Nginx's default HTML serving directory
COPY --chown=nginx:nginx --from=builder /app/src/frontend/dist/ /usr/share/nginx/html

# Entrypoint that renders assets/config.json from config.template.json using
# envsubst at container start, so deployment config (API/Keycloak URLs) can
# change with just a container restart, not an image rebuild. --chmod is set
# directly on the COPY (rather than a separate RUN chmod) because this stage's
# base image already defaults to the non-root nginx user, which can't chmod
# a root-owned path.
COPY --chmod=755 ./frontend/docker-entrypoint.sh /docker-entrypoint.sh

# Use a built-in non-root user for security best practices
USER nginx

# Expose port 8080 to allow HTTP traffic
# Note: The default Nginx container now listens on port 8080 instead of 80
EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["-g", "daemon off;"]
