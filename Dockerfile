# syntax=docker/dockerfile:1

FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN apk add --no-cache python3 make g++ && npm install --omit=dev
COPY . .

FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache curl ffmpeg
COPY --from=build /app /app
EXPOSE 3000
CMD ["node", "src/server.js"]
