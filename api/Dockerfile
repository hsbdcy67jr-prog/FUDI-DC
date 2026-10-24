FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
COPY server.mjs live-catalog.json ./
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
