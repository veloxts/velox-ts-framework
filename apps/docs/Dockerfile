FROM node:20-slim

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source files
COPY . .

# Build the site
RUN rm -rf dist && pnpm build

# Expose port
EXPOSE 3000

# Start the server
ENV PORT=3000
CMD ["pnpm", "serve"]
