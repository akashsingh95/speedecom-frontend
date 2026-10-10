# Build Stage
FROM node:22-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_ENABLE_MEESHO_AUTOSYNC
ENV VITE_ENABLE_MEESHO_AUTOSYNC=$VITE_ENABLE_MEESHO_AUTOSYNC
ARG VITE_GST_RATE=18
ENV VITE_GST_RATE=$VITE_GST_RATE
ARG VITE_PAYMENT_OFFSET=0
ENV VITE_PAYMENT_OFFSET=$VITE_PAYMENT_OFFSET
ARG VITE_PAYMENT_MULTIPLIER=1
ENV VITE_PAYMENT_MULTIPLIER=$VITE_PAYMENT_MULTIPLIER
RUN npx vite build --base=/client/

# Production Stage
FROM nginx:alpine
# Create the subdirectory to match the base path
RUN mkdir -p /usr/share/nginx/html/client
COPY --from=build /app/dist /usr/share/nginx/html/client
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
