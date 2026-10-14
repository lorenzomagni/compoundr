import { rmSync } from "node:fs";
import { openDb } from "../src/server/db/schema";
import { createRepositories } from "../src/server/db/repositories";
import { seedKo } from "../tests/server/services/fixtures";

// Fresh database for every run, so tests never depend on earlier runs.
const path = "data/e2e.db";
for (const suffix of ["", "-wal", "-shm"]) rmSync(path + suffix, { force: true });

const repos = createRepositories(openDb(path));
seedKo(repos, { dividends: [{ exDate: "2024-03-14", amount: 0.49 }] });
repos.companies.upsert({ ticker: "PG", name: "Procter & Gamble", sector: "Consumer Staples", cik: "80424", inSp500: true });
repos.companies.upsert({ ticker: "JNJ", name: "Johnson & Johnson", sector: "Health Care", cik: "200406", inSp500: true });
console.log("e2e database seeded at", path);
