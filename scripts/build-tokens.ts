/**
 * Compoundr design tokens build.
 *
 *   npm run tokens:build            write src/web/theme/tokens.css
 *   npm run tokens:check            fail if the committed file is out of date (CI)
 *   npm run tokens:diff             compare generated output with the existing file, write nothing
 *   ... -- --out some/other.css     override the output path (works with every mode)
 *
 * Source of truth: design-system/tokens.json. Run from the repository root.
 */
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------- config
const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "design-system/tokens.json");
const CHANGELOG = path.join(ROOT, "design-system/CHANGELOG.md");
const DEFAULT_OUT = path.join(ROOT, "src/web/theme/tokens.css");

/** tokens.json theme ids -> the app's theme names. The first theme in the file is the default. */
const THEME_NAMES: Record<string, "dark" | "light"> = { obsidian: "dark", ivory: "light" };

// ---------------------------------------------------------------- types
type ThemeValue = string | Record<string, string>;
interface Token { name: string; value: ThemeValue; usage?: string }
interface TypeStyle { name: string; fontSize: string; lineHeight?: string; fontWeight?: number | string; letterSpacing?: string; family?: string }
interface TokensFile {
  name: string;
  version: number;
  color: { themes: { id: string; name: string }[]; tokens: Token[] };
  type: { families: Record<string, string>; groups: { name: string; family: string; styles: TypeStyle[] }[] };
  spacing: { tokens: Token[] };
  radius: { tokens: Token[] };
  layout?: { tokens: Token[] };
  motion?: { tokens: Token[] };
  shadow?: { tokens: Token[] };
}

// ---------------------------------------------------------------- helpers
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\([^()]*\)|\{[A-Za-z0-9_.-]+\})$/;

function fail(message: string): never {
  console.error(`tokens: ${message}`);
  process.exit(1);
}

function cssName(name: string): string {
  return `--${name.replace(/\./g, "\\.")}`;
}

function pick(value: ThemeValue, themeId: string, firstId: string): string {
  if (typeof value === "string") return value;
  return value[themeId] ?? value[firstId];
}

function resolveAlias(value: string): string {
  const m = /^\{([A-Za-z0-9_.-]+)\}$/.exec(value);
  return m ? `var(${cssName(m[1])})` : value;
}

function readVersion(): string {
  try {
    const m = /^##\s*\[(\d+\.\d+\.\d+)\]/m.exec(fs.readFileSync(CHANGELOG, "utf8"));
    if (m) return m[1];
  } catch { /* changelog is optional for the build */ }
  return "unversioned";
}

// ---------------------------------------------------------------- validate
function validate(t: TokensFile): void {
  const themes = t.color.themes.map((x) => x.id);
  for (const id of themes) if (!THEME_NAMES[id]) fail(`theme "${id}" has no entry in THEME_NAMES (scripts/build-tokens.ts)`);
  if (new Set(themes.map((id) => THEME_NAMES[id])).size !== themes.length) fail("two themes map to the same name");

  const seen = new Set<string>();
  const check = (family: string, tokens: Token[]) => {
    for (const tok of tokens) {
      if (!NAME_RE.test(tok.name)) fail(`${family}: invalid token name "${tok.name}"`);
      if (seen.has(tok.name)) fail(`duplicate token name "${tok.name}" (names share one namespace)`);
      seen.add(tok.name);
    }
  };
  check("color", t.color.tokens);
  check("spacing", t.spacing.tokens);
  check("radius", t.radius.tokens);
  check("layout", t.layout?.tokens ?? []);
  check("motion", t.motion?.tokens ?? []);
  check("shadow", t.shadow?.tokens ?? []);

  const colorNames = new Set(t.color.tokens.map((x) => x.name));
  for (const tok of t.color.tokens) {
    const values = typeof tok.value === "string" ? [tok.value] : Object.values(tok.value);
    for (const v of values) {
      if (!COLOR_RE.test(v)) fail(`color "${tok.name}": unsupported value "${v}"`);
      const alias = /^\{(.+)\}$/.exec(v);
      if (alias && !colorNames.has(alias[1])) fail(`color "${tok.name}": alias to missing token "${alias[1]}"`);
      if (alias && alias[1] === tok.name) fail(`color "${tok.name}": alias to itself`);
    }
    if (typeof tok.value !== "string") {
      const missing = themes.filter((id) => !(id in (tok.value as Record<string, string>)));
      if (missing.includes(themes[0])) fail(`color "${tok.name}": the default theme (${themes[0]}) must have a value`);
    }
  }
  for (const key of Object.keys(t.type.families)) if (!NAME_RE.test(key)) fail(`font family key "${key}" is invalid`);
  for (const g of t.type.groups) {
    if (!(g.family in t.type.families)) fail(`type group "${g.name}": unknown family "${g.family}"`);
    for (const s of g.styles) if (!NAME_RE.test(s.name)) fail(`type style "${s.name}" has an invalid name`);
  }
}

// ---------------------------------------------------------------- generate
function themeBlock(t: TokensFile, themeId: string, indent: string): string[] {
  const first = t.color.themes[0].id;
  const lines: string[] = [`${indent}color-scheme: ${THEME_NAMES[themeId]};`];
  for (const tok of t.color.tokens) {
    lines.push(`${indent}${cssName(tok.name)}: ${resolveAlias(pick(tok.value, themeId, first))};`);
  }
  for (const tok of t.shadow?.tokens ?? []) {
    lines.push(`${indent}${cssName(tok.name)}: ${pick(tok.value, themeId, first)};`);
  }
  return lines;
}

function generate(t: TokensFile): string {
  const first = t.color.themes[0].id;
  const out: string[] = [];
  out.push(
    "/* GENERATED FILE. Do not edit by hand.",
    " * Source:      design-system/tokens.json",
    " * Regenerate:  npm run tokens:build",
    ` * Version:     ${readVersion()}`,
    " */",
    "",
    "/* Theme-independent tokens */",
    ":root {",
  );
  for (const [key, stack] of Object.entries(t.type.families)) out.push(`  --font-${key}: ${stack};`);
  out.push("");
  for (const tok of t.spacing.tokens) out.push(`  ${cssName(tok.name)}: ${tok.value};`);
  out.push("");
  for (const tok of t.radius.tokens) out.push(`  ${cssName(tok.name)}: ${tok.value};`);
  out.push("");
  for (const tok of t.layout?.tokens ?? []) out.push(`  ${cssName(tok.name)}: ${tok.value};`);
  out.push("");
  for (const tok of t.motion?.tokens ?? []) out.push(`  ${cssName(tok.name)}: ${tok.value};`);
  out.push("");
  out.push("  /* Type styles: use as `font: var(--type-body);` plus `letter-spacing: var(--type-body-tracking);` where present. Size only: `font-size: var(--type-body-size);` */");
  for (const g of t.type.groups) {
    for (const s of g.styles) {
      const weight = s.fontWeight ?? 400;
      const size = s.lineHeight ? `${s.fontSize}/${s.lineHeight}` : s.fontSize;
      out.push(`  --type-${s.name}: ${weight} ${size} var(--font-${s.family ?? g.family});`);
      out.push(`  --type-${s.name}-size: ${s.fontSize};`);
      if (s.letterSpacing) out.push(`  --type-${s.name}-tracking: ${s.letterSpacing};`);
    }
  }
  out.push("}", "");

  const defaultName = THEME_NAMES[first];
  out.push(`/* ${defaultName} (default) */`, `:root,`, `[data-theme="${defaultName}"] {`, ...themeBlock(t, first, "  "), "}", "");

  for (const theme of t.color.themes.slice(1)) {
    const name = THEME_NAMES[theme.id];
    out.push(
      `/* ${name}: follows the system preference unless ${defaultName} is forced */`,
      `@media (prefers-color-scheme: ${name}) {`,
      `  :root:not([data-theme="${defaultName}"]) {`,
      ...themeBlock(t, theme.id, "    "),
      "  }",
      "}",
      "",
      `/* ${name}: explicit */`,
      `[data-theme="${name}"] {`,
      ...themeBlock(t, theme.id, "  "),
      "}",
      "",
    );
  }
  return out.join("\n");
}

// ---------------------------------------------------------------- diff
type Bucket = "base" | "light";
type VarMap = Map<string, string>;

/** Minimal CSS reader: collects custom properties per bucket. Light = data-theme="light" or prefers light. */
function readVars(css: string): Record<Bucket, VarMap> {
  const result: Record<Bucket, VarMap> = { base: new Map(), light: new Map() };
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const stack: string[] = [];
  let buffer = "";
  for (const ch of text) {
    if (ch === "{") { stack.push(buffer.trim()); buffer = ""; }
    else if (ch === "}") { flush(); stack.pop(); }
    else if (ch === ";") { flush(); }
    else buffer += ch;
  }
  function flush(): void {
    const decl = buffer.trim();
    buffer = "";
    const m = /^(--[A-Za-z0-9_\\.-]+)\s*:\s*([\s\S]+)$/.exec(decl);
    if (!m) return;
    const ctx = stack.join(" ");
    const bucket: Bucket = /data-theme\s*=\s*["']?light|prefers-color-scheme\s*:\s*light/.test(ctx) ? "light" : "base";
    result[bucket].set(m[1], m[2].trim().replace(/\s+/g, " "));
  }
  return result;
}

function printDiff(existingCss: string, generatedCss: string, existingPath: string): void {
  const a = readVars(existingCss);
  const b = readVars(generatedCss);
  console.log(`Comparing ${path.relative(ROOT, existingPath)} (existing) with generated output.`);
  console.log("Heuristic: light = [data-theme=light] or prefers-color-scheme: light; everything else is base/dark.\n");
  let total = 0;
  for (const bucket of ["base", "light"] as Bucket[]) {
    const onlyOld = [...a[bucket].keys()].filter((k) => !b[bucket].has(k));
    const onlyNew = [...b[bucket].keys()].filter((k) => !a[bucket].has(k));
    const same = (k: string) => a[bucket].get(k)?.toLowerCase() === b[bucket].get(k)?.toLowerCase();
    const changed = [...a[bucket].keys()].filter((k) => b[bucket].has(k) && !same(k));
    total += onlyOld.length + onlyNew.length + changed.length;
    console.log(`== ${bucket} ==`);
    console.log(`  same: ${[...a[bucket].keys()].filter((k) => b[bucket].has(k) && same(k)).length}`);
    if (changed.length) { console.log("  changed value:"); for (const k of changed) console.log(`    ${k}: ${a[bucket].get(k)}  ->  ${b[bucket].get(k)}`); }
    if (onlyOld.length) { console.log("  only in existing (would disappear, check usages with grep):"); for (const k of onlyOld) console.log(`    ${k}: ${a[bucket].get(k)}`); }
    if (onlyNew.length) { console.log("  new in generated:"); for (const k of onlyNew) console.log(`    ${k}: ${b[bucket].get(k)}`); }
    console.log("");
  }
  console.log(total === 0 ? "No differences." : `${total} difference(s). Resolve before committing the generated file.`);
}

// ---------------------------------------------------------------- main
function main(): void {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("--out");
  const out = outIdx >= 0 ? path.resolve(ROOT, args[outIdx + 1] ?? fail("--out needs a path")) : DEFAULT_OUT;
  const mode = args.includes("--check") ? "check" : args.includes("--diff") ? "diff" : "build";

  if (!fs.existsSync(SOURCE)) fail(`cannot find ${path.relative(ROOT, SOURCE)}. Run from the repository root.`);
  const tokens = JSON.parse(fs.readFileSync(SOURCE, "utf8")) as TokensFile;
  validate(tokens);
  const css = generate(tokens);

  if (mode === "diff") {
    if (!fs.existsSync(out)) fail(`nothing to compare: ${path.relative(ROOT, out)} does not exist`);
    printDiff(fs.readFileSync(out, "utf8"), css, out);
    return;
  }
  if (mode === "check") {
    // Line endings are normalised so a CRLF checkout (core.autocrlf) does not look out of date.
    const current = fs.existsSync(out) ? fs.readFileSync(out, "utf8").replace(/\r\n/g, "\n") : "";
    if (current !== css) fail(`${path.relative(ROOT, out)} is out of date. Run "npm run tokens:build" and commit the result.`);
    console.log("tokens: up to date");
    return;
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, css);
  const count = (css.match(/^\s*--[^:]+:/gm) ?? []).length;
  console.log(`tokens: wrote ${path.relative(ROOT, out)} (${count} declarations)`);
}

main();
