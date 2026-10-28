FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY tsconfig.json ./
COPY src ./src

RUN npm run build


FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

# Install pm2 globally
RUN npm install -g pm2

COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY ecosystem.config.cjs ./

# Copy sharjah-job-agent and install its production dependencies + generate prisma client
COPY sharjah-job-agent ./sharjah-job-agent
RUN cd sharjah-job-agent && npm install --omit=dev && npx prisma generate

CMD ["pm2-runtime", "ecosystem.config.cjs"]
