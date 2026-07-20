FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts
COPY migrations ./migrations
COPY public ./public
COPY certs ./certs

ENV NODE_ENV=production
ENV PORT=5050

EXPOSE 5050

CMD ["node", "src/server.js"]
