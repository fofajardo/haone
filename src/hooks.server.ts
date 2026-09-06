import { env as publicEnv } from "$env/dynamic/public";
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
      let transformedHtml = html;

      const PUBLIC_GSV_ID = publicEnv.PUBLIC_GSV_ID;
      if (PUBLIC_GSV_ID) {
        const metaTag = `<meta name="google-site-verification" content="${PUBLIC_GSV_ID}" />`;
        transformedHtml = transformedHtml.replace("%google_site_verification%", metaTag);
      } else {
        transformedHtml = transformedHtml.replace("%google_site_verification%", "");
      }

      const PUBLIC_GA_ID = publicEnv.PUBLIC_GA_ID;
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
        transformedHtml = transformedHtml.replace("%google_analytics%", gaScript);
      } else {
        transformedHtml = transformedHtml.replace("%google_analytics%", "");
      }

      return transformedHtml;
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
