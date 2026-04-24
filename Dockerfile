FROM node:20

# Create app directory
WORKDIR /app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install dependencies (will build native modules like sqlite3 using the container's GLIBC)
RUN npm install --production

# Bundle app source
COPY . .

# Expose port
EXPOSE 3000

# Start command
CMD [ "npm", "start" ]