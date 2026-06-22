#!/usr/bin/env node

/**
 * create-openshop
 *
 * Interactive CLI that scaffolds a new OpenShop storefront project.
 * Usage:
 *   npm create openshop@latest
 *   npm create openshop@latest my-store
 *   npx create-openshop my-store --template next
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  statSync,
  copyFileSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { createInterface } from "node:readline";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const TEMPLATES_DIR = resolve(__dirname, "..", "templates");

const TEMPLATES = readdirSync(TEMPLATES_DIR).filter((name) =>
  statSync(join(TEMPLATES_DIR, name)).isDirectory(),
);

function ask(rl, question, fallback) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim() || fallback);
    });
  });
}

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

function replaceInFile(filePath, replacements) {
  let content = readFileSync(filePath, "utf-8");
  for (const [key, value] of Object.entries(replacements)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }
  writeFileSync(filePath, content);
}

function walkFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(full));
    else files.push(full);
  }
  return files;
}

async function main() {
  const args = process.argv.slice(2);
  const flags = {};
  const positional = [];

  for (const arg of args) {
    if (arg.startsWith("--")) {
      const [key, ...rest] = arg.slice(2).split("=");
      flags[key] = rest.join("=") || "true";
    } else {
      positional.push(arg);
    }
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log("\n🛒 create-openshop\n");

  const projectName =
    positional[0] || (await ask(rl, "Project name: ", "my-openshop-store"));
  const template =
    flags.template ||
    (await ask(rl, `Template (${TEMPLATES.join(", ")}): `, TEMPLATES[0]));
  const storeDomain = await ask(
    rl,
    "Store domain (e.g. my-shop.myshopify.com): ",
    "demo.myshopify.com",
  );

  rl.close();

  if (!TEMPLATES.includes(template)) {
    console.error(
      `\n❌ Unknown template "${template}". Available: ${TEMPLATES.join(", ")}`,
    );
    process.exit(1);
  }

  const targetDir = resolve(process.cwd(), projectName);
  if (existsSync(targetDir)) {
    console.error(`\n❌ Directory "${projectName}" already exists.`);
    process.exit(1);
  }

  console.log(`\n📁 Creating ${projectName} with template "${template}"...\n`);

  // Copy template
  copyDir(join(TEMPLATES_DIR, template), targetDir);

  // Replace placeholders
  const replacements = {
    PROJECT_NAME: projectName,
    STORE_DOMAIN: storeDomain,
  };

  for (const file of walkFiles(targetDir)) {
    if (/\.(json|ts|tsx|js|jsx|mjs|env|md|html)$/.test(file)) {
      replaceInFile(file, replacements);
    }
  }

  // Detect package manager
  const pm = detectPackageManager();

  console.log(`📦 Installing dependencies with ${pm}...\n`);
  execSync(`${pm} install`, { cwd: targetDir, stdio: "inherit" });

  console.log(`
✅ Done! Your OpenShop storefront is ready.

  cd ${projectName}
  ${pm === "pnpm" ? "pnpm" : "npm run"} dev

📖 Documentation: https://github.com/your-org/openshop
`);
}

function detectPackageManager() {
  const ua = process.env.npm_config_user_agent ?? "";
  if (ua.startsWith("pnpm")) return "pnpm";
  if (ua.startsWith("yarn")) return "yarn";
  return "npm";
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
