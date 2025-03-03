FROM node:16-alpine

# Create and switch to the app directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the source code
COPY . .

# Expose the port that your server listens on
EXPOSE 5000

# Start your server
CMD ["node", "server.js"]
