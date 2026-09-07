FROM node:22-bookworm-slim AS web-build
WORKDIR /workspace
ARG VITE_DEMO_MODE=false
ENV VITE_DEMO_MODE=${VITE_DEMO_MODE}
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile
COPY design design
COPY scripts scripts
COPY apps/web apps/web
RUN pnpm generate:tokens && pnpm --filter @bookkin/web build

FROM eclipse-temurin:21-jdk-noble AS server-build
WORKDIR /workspace
COPY apps/server apps/server
COPY docs/openapi docs/openapi
COPY --from=web-build /workspace/apps/web/dist/client apps/server/src/main/resources/static
RUN cd apps/server && ./mvnw -q -DskipTests package

FROM eclipse-temurin:21-jre-noble
RUN apt-get update \
    && apt-get install --yes --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --chmod=0644 --from=server-build /workspace/apps/server/target/bookkin-0.1.0-SNAPSHOT.jar /app/bookkin.jar
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -Djava.io.tmpdir=/tmp/bookkin"
ENTRYPOINT ["java", "-jar", "/app/bookkin.jar"]
