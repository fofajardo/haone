import { PUBLIC_GA_ID } from "$env/static/public";
import type { Handle, HandleServerError } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  return await resolve(event, {
    transformPageChunk: ({ html }) => {
      if (PUBLIC_GA_ID) {
        const gaScript = `
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${PUBLIC_GA_ID}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag() {
        dataLayer.push(arguments);
      }
      gtag("js", new Date());

      gtag("config", "${PUBLIC_GA_ID}");
    </script>`;
        return html.replace("%google_analytics%", gaScript);
      }
      return html.replace("%google_analytics%", "");
    }
  });
};

export const handleError: HandleServerError = ({ error }) => {
  console.error(error);
  return {
    message: (error as Error)?.message ?? "An unexpected error occurred",
    stack: (error as Error)?.stack ?? ""
  };
};
