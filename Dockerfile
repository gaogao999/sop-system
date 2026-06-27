FROM node:22-slim

WORKDIR /app

# poppler-utils provides `pdftotext`, used for experimental PDF header extraction
RUN apt-get update \
  && apt-get install -y --no-install-recommends poppler-utils \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies first so the layer is cached
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV PORT=3000
# Store the DB and uploaded files on the persistent disk mounted at /data
ENV DB_PATH=/data/sop.db
ENV UPLOAD_DIR=/data/uploads
EXPOSE 3000

CMD ["node", "server.js"]
