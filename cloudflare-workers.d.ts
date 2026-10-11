type D1Database = unknown;
type Fetcher = {
  fetch(request: Request): Promise<Response>;
};

type ExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException?(): void;
};

declare module "cloudflare:workers" {
  export const env: {
    DB?: D1Database;
  };
}
