FROM node:19-alpine3.16
RUN apk update && apk upgrade
RUN npm i -g pnpm
WORKDIR /app
