import { loadConfig } from "./config";
import { openDb } from "./db/schema";
import { createRepositories } from "./db/repositories";
import { createCache } from "./providers/cache";
import { createEdgarConnector } from "./providers/edgar";
import { createFmpConnector } from "./providers/fmp";
import { createTiingoConnector } from "./providers/tiingo";
import type { Connectors } from "./services/refresh";
import { buildServer } from "./api/routes";
import { createGateway } from "./gateway/gateway";

// The server listens on 127.0.0.1 only: the app is local and the API must not be reachable from the network.
async function main() {
  // COMPOUNDR_CONFIG lets the end-to-end suite point at its own config; the default is config/local.json.
  const config = loadConfig(process.env.COMPOUNDR_CONFIG);
  const repos = createRepositories(openDb(config.dbPath));
  const cache = createCache(repos.cache);
  const keys = {
    tiingo: config.tiingoApiKey,
    fmp: config.fmpApiKey,
    edgar: config.edgarUserAgent,
    wikipedia: config.edgarUserAgent,
  };
  const gateway = createGateway({ repos, keys });
  // The gateway hands a send to the function it runs; each connector is built on it, so every request is counted against its quota.
  const connectors: Connectors = {
    tiingo: (send) => createTiingoConnector(send, config.tiingoApiKey ?? ""),
    fmp: (send) => createFmpConnector(send, config.fmpApiKey ?? ""),
    edgar: (send) => createEdgarConnector(send, config.edgarUserAgent),
  };

  const app = await buildServer({
    repos,
    cache,
    connectors,
    apiKeyConfigured: config.fmpApiKey !== null,
    tiingoKeyConfigured: config.tiingoApiKey !== null,
    userAgent: config.edgarUserAgent,
    gateway,
    keys,
  });
  await app.listen({ host: "127.0.0.1", port: config.port });
  console.log(`Compoundr in ascolto su http://127.0.0.1:${config.port}`);
}

main().catch((error) => {
  console.error((error as Error).message);
  process.exit(1);
});
