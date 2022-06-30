FROM node:16-bullseye-slim

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app

COPY --chown=node:node . .
RUN rm /home/node/app/Dockerfile \
    && rm /home/node/app/README.md

USER node

RUN npm install

CMD [ "node", "RDMMonitor.js" ]

