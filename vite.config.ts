import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { execSync } from "child_process";
import pkg from "./package.json" with { type: "json" };

const commitSha = execSync("git rev-parse --short HEAD").toString().trim();
const appVersion = pkg.version;

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  define: {
    __COMMIT_SHA__: JSON.stringify(commitSha),
    __APP_VERSION__: JSON.stringify(appVersion)
  },
  ssr: {
    noExternal: ["layerchart", "svelte-sonner"]
  }
});
