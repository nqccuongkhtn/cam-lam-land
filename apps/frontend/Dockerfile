# Frontend = Next.js (App Router). Runs in dev mode for a zero-config local demo.
# For production: change CMD to `npm run build && npm run start`.
FROM node:20-bookworm-slim
WORKDIR /app
COPY apps/frontend/package.json ./package.json
RUN npm install
COPY apps/frontend ./
EXPOSE 3000
CMD ["npm", "run", "dev"]
