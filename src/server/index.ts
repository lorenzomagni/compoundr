import { loadConfig } from "./config";
import { openDb } from "./db/schema";
import { createRepositories } from "./db/repositories";
import { createCache } from "./providers/cache";
import { createEdgarClient } from "./providers/edgar";
import { createFmpClient } from "./providers/fmp";
import { buildServer } from "./api/routes";

// The server listens on 127.0.0.1 only: the app is local and the API must not be reachable from the network.
async function main() {
  // COMPOUNDR_CONFIG lets the end-to-end suite point at its own config; the default is config/local.json.
  const config = loadConfig(process.env.COMPOUNDR_CONFIG);
  const repos = createRepositories(openDb(config.dbPath));
  const cache = createCache(repos.cache);
  const edgar = createEdgarClient({ userAgent: config.edgarUserAgent });
  const fmp = createFmpClient({ apiKey: config.fmpApiKey, cache: repos.cache });

  const app = await buildServer({
    repos,
    cache,
    edgar,
    fmp,
    apiKeyConfigured: config.fmpApiKey !== null,
    userAgent: config.edgarUserAgent,
  });
  await app.listen({ host: "127.0.0.1", port: config.port });
  console.log(`Compoundr in ascolto su http://127.0.0.1:${config.port}`);
}

main().catch((error) => {
  console.error((error as Error).message);
  process.exit(1);
});
