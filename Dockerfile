# Dockerfile

# Use an official Node.js runtime as a parent image (Debian-based variant)
# Choose a version compatible with your Next.js version (e.g., 18 or 20)
FROM node:18 AS base

# Set the working directory in the container
WORKDIR /app

# Install Prisma CLI globally in the image (optional, but can be useful)
# RUN npm install -g prisma

# --- Dependencies Stage ---
FROM base AS deps
# Removing apt-get commands for vips-dev for troubleshooting on ARM
# RUN apt-get update
# RUN apt-get install -y --no-install-recommends vips-dev && rm -rf /var/lib/apt/lists/*

# Install dependencies based on the preferred package manager
# Automatically detect package-lock.json or yarn.lock and install dependencies accordingly
# If you use pnpm, you'll need to adapt this section
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# --- Builder Stage (includes Prisma generate) ---
FROM base AS builder
# Copy dependencies from the previous stage
COPY --from=deps /app/node_modules ./node_modules
# Copy the rest of the application code
# We copy package.json again here to ensure it's available for prisma generate
COPY package.json ./
COPY . .

# Generate Prisma Client - crucial step!
# This needs to happen *inside* the container environment after code is copied
RUN npx prisma generate

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry.
# ENV NEXT_TELEMETRY_DISABLED 1

# --- Runner Stage (for Development) ---
# Re-use the base image for the final stage
FROM base AS runner
WORKDIR /app

# Copy necessary files from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
# Copy the generated Prisma client files
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
# Copy the Prisma schema file
COPY --from=builder /app/prisma ./prisma
# Copy the rest of the app code (needed for dev server)
COPY --from=builder /app ./

# Ensure Prisma client is generated (redundant if done in builder, but safe)
# RUN npx prisma generate

# Expose the port the app runs on
EXPOSE 3000

# Set the default command to start the development server
# This will be overridden by the 'command: npm run dev' in docker-compose.yml
# when running in development mode via compose.
CMD ["npm", "run", "dev"]

