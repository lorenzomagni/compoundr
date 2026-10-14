import { readFileSync, existsSync } from "node:fs";
import { z } from "zod";

export interface AppConfig {
  fmpApiKey: string | null;
  edgarUserAgent: string;
  dbPath: string;
  port: number;
}

const RawConfig = z.object({
  fmpApiKey: z.string().min(1).nullable().optional(),
  edgarUserAgent: z.string(),
  dbPath: z.string().default("data/compoundr.db"),
  port: z.number().int().positive().default(3000),
});

const DEFAULT_PATH = "config/local.json";

// SEC fair-access policy: the User-Agent must identify the requester with contact info.
function assertContact(userAgent: string): void {
  if (!/@|https?:\/\//.test(userAgent)) {
    throw new Error(
      "edgarUserAgent must include contact info (email or URL): contatto richiesto dalla SEC",
    );
  }
}

// Accepts a raw object (tests, programmatic use) or a path to a JSON file (default config/local.json).
export function loadConfig(input?: string | unknown): AppConfig {
  let raw: unknown;
  if (typeof input === "object" && input !== null) {
    raw = input;
  } else {
    const path = typeof input === "string" ? input : DEFAULT_PATH;
    if (!existsSync(path)) {
      throw new Error(
        `File di configurazione mancante: ${path}. Crealo partendo da config/local.example.json con un User-Agent che includa un contatto.`,
      );
    }
    raw = JSON.parse(readFileSync(path, "utf8"));
  }
  const parsed = RawConfig.parse(raw);
  assertContact(parsed.edgarUserAgent);
  return {
    fmpApiKey: parsed.fmpApiKey ?? null,
    edgarUserAgent: parsed.edgarUserAgent,
    dbPath: parsed.dbPath,
    port: parsed.port,
  };
}
