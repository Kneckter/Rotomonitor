FROM node:16.14.2

WORKDIR /usr/src/app

COPY package.json .
COPY package-lock.json .
RUN npm install
COPY . .

CMD [ "node", "RDMMonitor.js" ]