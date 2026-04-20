import { defineConfig } from "jsrepo";

export default defineConfig({
  // configure where stuff comes from here
  registries: [],
  // configure where stuff goes here
  paths: {
    ui: "src/lib/components/ui",
    lib: "src/lib"
  }
});
