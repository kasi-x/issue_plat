FROM node:20-bullseye

WORKDIR /app

# Install Rust toolchain and Trunk inside the container
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates build-essential pkg-config && rm -rf /var/lib/apt/lists/* \
 && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal \
 && /root/.cargo/bin/rustup target add wasm32-unknown-unknown \
 && /root/.cargo/bin/cargo install trunk

ENV PATH="/root/.cargo/bin:${PATH}"

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate \
 && pnpm install --no-frozen-lockfile

COPY . .

EXPOSE 8788

# Run Trunk watcher and Node dev server together
CMD ["/bin/bash","-lc","cd leptos-app && trunk watch --dist ../public/assets & pnpm run dev"]
