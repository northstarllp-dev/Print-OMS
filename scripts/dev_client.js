/**
 * Run next dev with CLIENT_SLUG / NEXT_PUBLIC_CLIENT_SLUG overridden.
 * Usage: node scripts/dev_client.js printoms
 */
const { spawn } = require("child_process");
const path = require("path");

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node scripts/dev_client.js <slug>");
  process.exit(1);
}

const env = {
  ...process.env,
  CLIENT_SLUG: slug,
  NEXT_PUBLIC_CLIENT_SLUG: slug,
};

const nextBin = path.join(
  __dirname,
  "..",
  "node_modules",
  "next",
  "dist",
  "bin",
  "next"
);

const child = spawn(
  process.execPath,
  [nextBin, "dev", "-p", "3001", "--turbo"],
  { stdio: "inherit", env, cwd: path.join(__dirname, "..") }
);
child.on("exit", (code) => process.exit(code ?? 0));
