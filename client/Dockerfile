# Use Node.js 18 Alpine for build
FROM node:18-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Use Nginx for serving static files
FROM nginx:alpine

# Copy built app to Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom Nginx config if needed (optional)
# COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]</content>
<parameter name="filePath">/Users/babbarsher/Desktop/Comprehensive-Campus-Healthcare-System/client/Dockerfile