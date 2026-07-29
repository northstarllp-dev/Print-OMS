/**
 * Scaffold a new client config + env example + public assets folder.
 *
 * Usage:
 *   node scripts/scaffold_client.js --slug=signworld --name="Signworld" --company-id=<uuid>
 */
const fs = require("fs");
const path = require("path");

function arg(name, fallback = "") {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const slug = arg("slug");
const name = arg("name", slug);
const companyId = arg("company-id");

if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error("Usage: --slug=kebab-case --name=\"Display Name\" --company-id=<uuid>");
  process.exit(1);
}
if (!companyId) {
  console.error("Missing --company-id=<uuid>");
  process.exit(1);
}

const root = path.join(__dirname, "..");
const clientDir = path.join(root, "src", "config", "clients", slug);
const envPath = path.join(root, "config", "env", `${slug}.env.example`);
const publicDir = path.join(root, "public", "clients", slug);

if (fs.existsSync(clientDir)) {
  console.error(`Client folder already exists: ${clientDir}`);
  process.exit(1);
}

const exportName =
  slug
    .split("-")
    .map((p, i) => (i === 0 ? p : p[0].toUpperCase() + p.slice(1)))
    .join("") + "Config";

const indexTs = `import { PrintOMSClientConfig } from "../../schema";

const edit = (
  ...stages: Array<
    | "site_visit"
    | "quotation"
    | "design"
    | "production"
    | "installation"
    | "service_tickets"
  >
) => {
  const map: NonNullable<PrintOMSClientConfig["stageGrantsByRole"]>[string] = {};
  for (const s of stages) map[s] = { canView: true, canEdit: true };
  return map;
};

export const ${exportName}: Partial<PrintOMSClientConfig> = {
  id: "${slug}",
  name: ${JSON.stringify(name)},
  companyId: "${companyId}",
  colors: {
    primary: "#1E40AF",
    onPrimary: "#ffffff",
    primaryContainer: "#dbeafe",
    onPrimaryContainer: "#1E40AF",
    secondary: "#1E40AF",
    onSecondary: "#ffffff",
    secondaryContainer: "#F1F3F6",
    onSecondaryContainer: "#1E40AF",
    background: "#F4F5F8",
    surface: "#ffffff",
    sidebarBg: "#0C0F1A",
    sidebarText: "#94A3B8",
    sidebarActiveBg: "#1A2035",
    sidebarActiveText: "#E2E8F0",
    sidebarAccent: "#F97316",
  },
  logoUrl: "/clients/${slug}/logo.png",
  faviconUrl: "/clients/${slug}/favicon_io/favicon.ico",
  loadingText: ${JSON.stringify(String(name).toUpperCase())},
  features: {
    enableAdminAssignment: false,
  },
  usesFloorPortals: false,
  stageGrantsByRole: {
    Production: edit("production", "service_tickets"),
    Installation: edit("site_visit", "installation"),
    Designer: edit("site_visit", "design"),
    Marketer: edit("site_visit", "quotation"),
  },
  whatsappTemplatePrefix: "${slug.replace(/-/g, "")}_",
};
`;

const envExample = `# ── Identity (${name}) ──
CLIENT_SLUG=${slug}
NEXT_PUBLIC_CLIENT_SLUG=${slug}

# ── WhatsApp (WABA) ──
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
META_WABA_ID=
WHATSAPP_GRAPH_API_VERSION=v21.0
WHATSAPP_ENABLED=true
WHATSAPP_CLIENT_NAME=${name}

# Also copy all vars from .env.shared.example into this Vercel project
`;

fs.mkdirSync(clientDir, { recursive: true });
fs.writeFileSync(path.join(clientDir, "index.ts"), indexTs);
fs.writeFileSync(envPath, envExample);
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(
  path.join(publicDir, ".gitkeep"),
  "# Drop logo.png and favicon_io/ assets here\n"
);

console.log(`Created ${clientDir}`);
console.log(`Created ${envPath}`);
console.log(`Created ${publicDir}`);
console.log(`
Next steps:
1. Import in src/config/registry.ts:
     import { ${exportName} } from "./clients/${slug}";
     "${slug}": ${exportName},
2. SQL:
     INSERT INTO public.companies (id, slug, name)
     VALUES ('${companyId}', '${slug}', ${JSON.stringify(name)})
     ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, name = EXCLUDED.name;
3. See docs/printoms/ADD_CLIENT.md
`);
