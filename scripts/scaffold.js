// scripts/scaffold.js
// Scaffolder Astro 5 + Tailwind v4 (zéro dépendance)
// Flags: --yes --force --name="Titre" --path=src/styles/tailwind.css --no-postcss
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import readline from "node:readline";

const C = {
  ok: (m) => console.log("\x1b[32m%s\x1b[0m", m),
  info: (m) => console.log("\x1b[36m%s\x1b[0m", m),
  warn: (m) => console.log("\x1b[33m%s\x1b[0m", m),
  err: (m) => console.log("\x1b[31m%s\x1b[0m", m),
};

const args = new Map(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));
const NO_POSTCSS = args.has("no-postcss");
const FORCE = args.has("force");
const YES = args.has("yes");
const CSS_PATH = args.get("path") || "src/styles/tailwind.css";
const THEME_NAME = args.get("name") || "Astro Theme Skeleton";

const base = process.cwd();
const ensureDir = (p) => { if (!existsSync(p)) { mkdirSync(p, { recursive: true }); C.ok(`+ dir  ${p}`); } };
const write = (p, content) => {
  if (existsSync(p) && !FORCE) { C.warn(`~ skip ${p} (exists)`); return false; }
  ensureDir(dirname(p));
  writeFileSync(p, content, "utf8");
  C.ok(`${existsSync(p) && FORCE ? "±" : "+"} file ${p}`);
  return true;
};

// Petite confirmation si des fichiers existent déjà (sauf --yes)
async function confirmIfExists(targets) {
  if (YES) return true;
  const collisions = targets.filter(p => existsSync(p));
  if (collisions.length === 0) return true;

  C.warn("Certains fichiers existent déjà :");
  collisions.forEach(p => console.log("  -", p));
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const q = (s) => new Promise(res => rl.question(s, res));
  const ans = (await q("Les écraser ? (o/N) ")).trim().toLowerCase();
  rl.close();
  return ans === "o" || ans === "oui" || ans === "y";
}

// ----- Templates -----
const files = {
  [CSS_PATH]: `@import "tailwindcss";\n`,
  "src/components/Layout.astro": `---
const { title = "${THEME_NAME}", description = "" } = Astro.props;
---
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="stylesheet" href="/${CSS_PATH.replace(/^src\\//, "src/")}" />
  </head>
  <body class="min-h-dvh bg-white text-zinc-900 antialiased">
    <header class="border-b">
      <div class="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
        <a href="/" class="font-semibold">${THEME_NAME}</a>
        <nav class="text-sm opacity-80 space-x-4">
          <a href="/" class="hover:underline">Accueil</a>
          <a href="/about" class="hover:underline">À propos</a>
        </nav>
      </div>
    </header>
    <main class="mx-auto max-w-5xl px-4 py-10">
      <slot />
    </main>
    <footer class="border-t">
      <div class="mx-auto max-w-5xl px-4 py-8 text-sm opacity-70">
        © {new Date().getFullYear()} ${THEME_NAME}
      </div>
    </footer>
  </body>
</html>
`,
  "src/pages/index.astro": `---
import Layout from "../components/Layout.astro";
---
<Layout title="Bienvenue 🚀">
  <section class="space-y-3 text-center">
    <h1 class="text-4xl font-bold tracking-tight">Hello Astro + Tailwind v4</h1>
    <p class="opacity-80">Squelette prêt à designer ton thème.</p>
    <div class="mt-6">
      <a href="/about" class="inline-block px-4 py-2 rounded-md border hover:bg-zinc-50">À propos</a>
    </div>
  </section>
</Layout>
`,
  "src/pages/about.astro": `---
import Layout from "../components/Layout.astro";
---
<Layout title="À propos">
  <h2 class="text-2xl font-semibold mb-2">À propos</h2>
  <p class="opacity-80">Ce thème est un squelette lean pour partir vite sur Astro 5 + Tailwind 4.</p>
</Layout>
`,
  "astro.config.mjs": `import { defineConfig } from "astro/config";
import tailwind from "@tailwindcss/vite";

export default defineConfig({
  vite: { plugins: [tailwind()] }
});
`,
  ".gitignore": `node_modules
dist
.cache
.idea
.DS_Store
astro/dist
playwright-report
`,
  "tsconfig.build.json": `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "declaration": true,
    "emitDeclarationOnly": false,
    "stripInternal": true,
    "sourceMap": false,
    "removeComments": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "strict": true,
    "types": ["astro/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
`,
  "README.md": `# ${THEME_NAME}

Squelette lean pour développer un thème **Astro 5 + Tailwind CSS v4**.

## Démarrage
\`\`\`bash
pnpm install
pnpm dev
\`\`\`

## Scripts
- \`pnpm dev\` — serveur de dev
- \`pnpm build\` — lint + build TS (adapter si besoin)
- \`pnpm preview\` — preview prod
- \`pnpm scaffold\` — (ré)génère l'arbo de base

## Structure
- \`src/pages\` — pages .astro
- \`src/components\` — composants .astro
- \`src/styles/tailwind.css\` — point d'entrée Tailwind v4
`
};

const postcssFile = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
`;

// ----- Main -----
(async () => {
  try {
    // Securité: vérifier qu'on est bien à la racine (présence du package.json)
    const pkgPath = join(base, "package.json");
    if (!existsSync(pkgPath)) {
      C.err("❌ package.json introuvable. Lance ce script à la racine du projet.");
      process.exit(1);
    }

    // Demande de confirmation si collision
    const targets = Object.keys(files).concat(NO_POSTCSS ? [] : ["postcss.config.cjs"]);
    const ok = await confirmIfExists(targets);
    if (!ok) {
      C.warn("Opération annulée.");
      process.exit(0);
    }

    // Création des fichiers
    for (const [p, content] of Object.entries(files)) write(join(base, p), content);
    if (!NO_POSTCSS) write(join(base, "postcss.config.cjs"), postcssFile);

    // Petit rappel si Tailwind n'est pas listé
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const hasTW = (pkg.devDependencies && pkg.devDependencies.tailwindcss) || (pkg.dependencies && pkg.dependencies.tailwindcss);
    if (!hasTW) {
      C.warn("⚠️ Tailwind n'est pas dans tes dépendances. Installe-le :");
      console.log("   pnpm add -D tailwindcss @tailwindcss/vite autoprefixer");
    }

    C.ok("✅ Scaffold terminé. Lance: pnpm dev");
  } catch (e) {
    C.err(`Erreur: ${e.message}`);
    process.exit(1);
  }
})();
