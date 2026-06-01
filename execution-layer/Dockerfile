FROM node:20-alpine

WORKDIR /usr/src/app

RUN apk add --no-cache curl python3 make g++ \
    && curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
    && chmod +x kubectl \
    && mv kubectl /usr/local/bin/

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000 3001

CMD ["npm", "run", "start:dev"]
