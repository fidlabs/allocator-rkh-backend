FROM node:22-alpine3.19

# Set the working directory
WORKDIR /usr/src/app

# Copy package manager files first to leverage Docker caching
COPY package.json package-lock.json tsconfig.json ./

# Copy the 'core' package and all other packages
COPY packages ./packages

# Install dependencies using npm, lock dependencies for reproducibility
RUN npm ci

# Build the specific package using the argument
RUN npm -w @filecoin-plus/core run build

# Build the specific package using the argument
RUN npm -w @filecoin-plus/application install

# Build the specific package using the argument
RUN npm -w @filecoin-plus/application run build 

# Expose the port the app runs on
EXPOSE 3000


# The CMD will be overridden by Docker Compose
CMD ["sh", "-c", "npm -w @filecoin-plus/application start"]
