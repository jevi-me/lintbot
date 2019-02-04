#!/usr/bin/env sh

openssl req -config ./scripts/localhost.conf -new -x509 -sha256 -newkey rsa:2048 -nodes -keyout ./app/https-key.pem -days 1460 -subj "/C=CA/ST=Ontario/L=Ottawa/O=Lintbot/OU=Lintbot/CN=Lintbot" -out ./app/https-cert.pem
