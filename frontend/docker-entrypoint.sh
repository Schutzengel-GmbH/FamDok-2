#!/bin/sh
set -eu

envsubst '$API_BASE_URL $KC_BASE_URL $KC_REALM $KC_CLIENT' \
  < /usr/share/nginx/html/assets/config.template.json \
  > /usr/share/nginx/html/assets/config.json

exec nginx -c /etc/nginx/nginx.conf "$@"
