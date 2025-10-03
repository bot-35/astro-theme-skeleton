// scripts/scaffold.js
// Scaffolder Astro 5 + Tailwind v4 (zéro dépendance, ESM)
// Flags: --yes --force --name="Titre" --path=src/styles/tailwind.css --no-postcss

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import readline from "node:readline";

// ---- utils console
const C = {
  ok:   (m) => console.log("\x1b[32m%s\x1b[0m", m),
  info: (m) => console.log("\x1b[36m%s\x1b[0m", m),
  warn: (m) => console.log("\x1b[33m%s\x1b[0m", m),
  err:  (m) => console.log("\x1b[31m%s\x1b[0m", m),
};

// ---- parse flags
const args = new Map(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);
const NO_POSTCSS = args.has("no-postcss");
const FORCE      = args.has("force");
const YES        = args.has("yes");
const CSS_PATH   = args.get("path") || "src/styles/tailwind.css";
const THEME_NAME_ = args.get("name") || "Astro Theme Skeleton";
const CONFIG_PATH = args.get("config") || "theme.meta.json";


function loadThemeMeta() {
  const defaults = {
    name: "Astro Theme Skeleton",
    description: "",
    colors: {
      bg: "#ffffff",
      fg: "#0a0a0a",
      primary: "#0ea5e9",
      "primary-foreground": "#ffffff",
      muted: "#f5f5f7",
      border: "#e5e7eb",
    },
  };

  // 1) fichier theme.meta.json (ou --config=...)
  if (existsSync(CONFIG_PATH)) {
    try {
      const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
      return { ...defaults, ...raw, colors: { ...defaults.colors, ...(raw.colors || {}) } };
    } catch (e) {
      C.warn(`~ Config ${CONFIG_PATH} illisible, on garde les defaults (${e.message})`);
      return defaults;
    }
  }

  // 2) fallback package.json > theme
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    if (pkg.theme && typeof pkg.theme === "object") {
      const raw = pkg.theme;
      return { ...defaults, ...raw, colors: { ...defaults.colors, ...(raw.colors || {}) } };
    }
  } catch {}

  return defaults;
}

// theme chargé
const THEME = loadThemeMeta();
const THEME_NAME = THEME_NAME_ || THEME.name;
const DESCRIPTION = THEME.description;
const LIGHT = THEME.colors || {};
const DARK  = (THEME.colors && THEME.colors.dark) || {};

function merge(a, b) { return { ...a, ...b }; }

// valeurs garanties sur les deux thèmes
const LIGHT_FULL = merge({
  bg: "#ffffff",
  fg: "#0a0a0a",
  primary: "#0ea5e9",
  "primary-foreground": "#ffffff",
  muted: "#f5f5f7",
  border: "#e5e7eb",
}, LIGHT);

const DARK_FULL = merge(LIGHT_FULL, DARK); // dark hérite du light par défaut


// helper pour transformer en CSS vars
function cssVars(vars) {
  const flat = Object.entries(vars).map(([k, v]) => `  --${k}: ${v};`).join("\n");
  return `:root {\n${flat}\n}\n`;
}

function cssVarsBlock(selector, vars) {
  const flat = Object.entries(vars)
    .map(([k, v]) => `  --color-${k}: ${v};`).join("\n");
  return `${selector} {\n${flat}\n}\n`;
}

// URL CSS normalisée pour <link> (gère Windows \ et enlève rien)
const cssHref = "/" + CSS_PATH.replace(/\\/g, "/");

// ---- FS helpers
const ensureDir = (p) => {
  if (!existsSync(p)) {
    mkdirSync(p, { recursive: true });
    C.ok(`+ dir  ${p}`);
  }
};
const write = (p, content) => {
  if (existsSync(p) && !FORCE) {
    C.warn(`~ skip ${p} (exists)`);
    return false;
  }
  ensureDir(dirname(p));
  writeFileSync(p, content, "utf8");
  C.ok(`${existsSync(p) && FORCE ? "±" : "+"} file ${p}`);
  return true;
};

// confirmation si collisions (sauf --yes)
async function confirmIfExists(paths) {
  if (YES) return true;
  const collisions = paths.filter((p) => existsSync(p));
  if (collisions.length === 0) return true;

  C.warn("Certains fichiers existent déjà :");
  collisions.forEach((p) => console.log("  -", p));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((res) => rl.question(q, res));
  const ans = (await ask("Les écraser ? (o/N) ")).trim().toLowerCase();
  rl.close();
  return ans === "o" || ans === "oui" || ans === "y";
}

// ---- templates à écrire
const files = {
[CSS_PATH]: `@import "tailwindcss";

${cssVarsBlock(':root', LIGHT_FULL)}
${cssVarsBlock(':root.dark, [data-theme="dark"]', DARK_FULL)}

/* Variables de thème (générées) */
${cssVars({
  "color-bg": THEME.colors.bg,
  "color-fg": THEME.colors.fg,
  "color-primary": THEME.colors.primary,
  "color-primary-foreground": THEME.colors["primary-foreground"],
  "color-muted": THEME.colors.muted,
  "color-border": THEME.colors.border,
})}
`,


  "src/components/Layout.astro": `---
const { title = "${THEME_NAME}", description = "" } = Astro.props;
---
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>{title}</title>
    <meta name="description" content=${DESCRIPTION} />
    <link rel="stylesheet" href="${cssHref}" />
  </head>
  <body class="min-h-dvh bg-[color:var(--color-bg)] text-[color:var(--color-fg)] antialiased">
    <header class="border-b">
      <div class="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
        <a href="/" class="font-semibold ">${THEME_NAME}</a>
        <nav class="text-sm opacity-80 space-x-4">
          <a href="/" class="hover:underline">Accueil</a>
          <a href="/about" class="hover:underline">À propos</a>
          <button id="theme-toggle" class="px-3 py-1 border rounded-md">
            🌙 / ☀️
          </button>
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

<script>
  const root = document.documentElement;
  const KEY = 'theme';
  const saved = localStorage.getItem(KEY);
  if (saved === 'dark' || (!saved && matchMedia('(prefers-color-scheme: dark)').matches)) {
    root.classList.add('dark');
  }

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const isDark = root.classList.toggle('dark');
    localStorage.setItem(KEY, isDark ? 'dark' : 'light');
  });
</script>

`,

  "src/pages/index.astro": `---
import Layout from "../components/Layout.astro";
---
<Layout title="Bienvenue 🚀">
  <section class="space-y-3 text-center">
    <h1 class="text-4xl font-bold tracking-tight">${THEME_NAME}</h1>
    <p class="opacity-80">${DESCRIPTION}</p>
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
  "tailwind.config.cjs": `/** @type {import('tailwindcss').Config} */
// tailwind.config.cjs — v4 minimal
module.exports = {
  // pas de "content" en v4
  darkMode: 'class',
  plugins: [
    // require('@tailwindcss/typography'),
    // require('@tailwindcss/forms'),
    // require('@tailwindcss/aspect-ratio'),
  ],
};
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
    "types": ["astro/client", "node"]
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



// ---- main
(async () => {
  try {
    // sécurité: vérifier la racine de projet
    const pkgPath = join(process.cwd(), "package.json");
    if (!existsSync(pkgPath)) {
      C.err("❌ package.json introuvable. Lance ce script à la racine du projet.");
      process.exit(1);
    }

    // confirmation si collisions
    const targets = Object.keys(files).concat(NO_POSTCSS ? [] : ["postcss.config.cjs"]);
    const ok = await confirmIfExists(targets);
    if (!ok) {
      C.warn("Opération annulée.");
      process.exit(0);
    }

    // création
    for (const [p, content] of Object.entries(files)) {
      write(join(process.cwd(), p), content);
    }

    // reminder deps Tailwind si absentes
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const hasTW =
      (pkg.devDependencies && pkg.devDependencies.tailwindcss) ||
      (pkg.dependencies && pkg.dependencies.tailwindcss);
    if (!hasTW) {
      C.warn("⚠️ Tailwind n'est pas dans tes dépendances. Installe-le :");
      console.log("   pnpm add -D tailwindcss @tailwindcss/vite autoprefixer");
    }

    C.ok("✅ Scaffold terminé. Lance: pnpm dev");
  } catch (e) {
    C.err(`Erreur: ${e?.message || e}`);
    process.exit(1);
  }
})();
