import { mdsvex } from "mdsvex";
import adapter from "@sveltejs/adapter-cloudflare";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    alias: {
      $components: "src/lib/components",
      $ui: "src/lib/components/ui",
      $utils: "src/lib/utils",
      $reports: "src/lib/reports",
      $state: "src/lib/state",
      $templates: "src/lib/templates",
      $logic: "src/lib/logic",
      $data: "src/lib/data",
      $dataPrivate: "src/lib/data-private",
      $services: "src/lib/services",
      $api: "src/lib/api"
    }
  },
  preprocess: [mdsvex()],
  extensions: [".svelte", ".svx"]
};

export default config;
