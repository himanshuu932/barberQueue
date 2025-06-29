FROM node:16-alpine

# Set the working directory
WORKDIR /app/server

# Copy package.json and package-lock.json (if present)
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of your code
COPY . .

# Let Cloud Run handle the PORT env var (or default to 8080)
ENV PORT 8080
EXPOSE 8080

# Start your server
CMD ["node", "server.js"]
