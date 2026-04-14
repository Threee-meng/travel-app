FROM node:18-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY dist ./dist
COPY deploy.js ./

EXPOSE 3001
ENV PORT=3001

CMD ["node", "deploy.js"]
