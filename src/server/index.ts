import { loadConfig } from "./config";
import { openDb } from "./db/schema";
import { createRepositories } from "./db/repositories";
import { createCache } from "./providers/cache";
import { createEdgarConnector } from "./providers/edgar";
import { createRateLimiter } from "./providers/rate-limiter";
import { createFmpConnector, FmpNoKey } from "./providers/fmp";
import { buildServer } from "./api/routes";
import { createGateway } from "./gateway/gateway";

// The server listens on 127.0.0.1 only: the app is local and the API must not be reachable from the network.
async function main() {
  // COMPOUNDR_CONFIG lets the end-to-end suite point at its own config; the default is config/local.json.
  const config = loadConfig(process.env.COMPOUNDR_CONFIG);
  const repos = createRepositories(openDb(config.dbPath));
  const cache = createCache(repos.cache);
  // Until the gateway is wired into the server, EDGAR keeps its own limiter as the send function.
  const edgarLimiter = createRateLimiter({ perSecond: 8, maxRetries: 3 });
  const edgar = createEdgarConnector((fn, isRetryable) => edgarLimiter.run(fn, isRetryable), config.edgarUserAgent);
  // Until Task 10 routes through the gateway, FMP keeps its own limiter as the send function.
  const fmpLimiter = createRateLimiter({ perSecond: 5, maxRetries: 2 });
  const noKey = async (): Promise<never> => {
    throw new FmpNoKey();
  };
  const fmp = config.fmpApiKey
    ? createFmpConnector((fn, isRetryable) => fmpLimiter.run(fn, isRetryable), config.fmpApiKey)
    : { dailyPrices: noKey, dividendHistory: noKey };

  const keys = {
    tiingo: config.tiingoApiKey,
    fmp: config.fmpApiKey,
    edgar: config.edgarUserAgent,
    wikipedia: config.edgarUserAgent,
  };
  const gateway = createGateway({ repos, keys });

  const app = await buildServer({
    repos,
    cache,
    edgar,
    fmp,
    apiKeyConfigured: config.fmpApiKey !== null,
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
