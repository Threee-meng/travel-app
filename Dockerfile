FROM node:20-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY index.html ./
COPY vite.config.js ./
COPY public ./public
COPY src ./src

RUN npm run build


FROM node:20-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
RUN npm ci --omit=dev

COPY deploy.js ./
COPY --from=build /app/dist ./dist

EXPOSE 3001

CMD ["node", "deploy.js"]
