import { PUBLIC_GA_ID } from "$env/static/public";
import { env } from "$env/dynamic/private";
import type { Handle, HandleServerError, RequestEvent } from "@sveltejs/kit";

async function checkMaintenanceRedirect(event: RequestEvent): Promise<Response | null> {
  let isMaintenance =
    (await event.platform?.env?.CONFIG_KV?.get("MAINTENANCE_MODE")) ||
    env.MAINTENANCE_MODE ||
    "false";

  if (isMaintenance !== "true") {
    return null;
  }

  const path = event.url.pathname;
  const isMaintenanceRoute = path.startsWith("/maintenance");
  const isStaticAsset =
    path.startsWith("/assets") ||
    path.startsWith("/_app") ||
    path.startsWith("/favicon") ||
    path.endsWith(".png") ||
    path.endsWith(".svg") ||
    path.endsWith(".css") ||
    path.endsWith(".js");

  if (!isMaintenanceRoute && !isStaticAsset) {
    return new Response(null, {
      status: 307,
      headers: { location: "/maintenance" }
    });
  }

  return null;
}

export const handle: Handle = async ({ event, resolve }) => {
  const maintenanceResponse = await checkMaintenanceRedirect(event);
  if (maintenanceResponse) {
    return maintenanceResponse;
  }

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
