import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url }) => {
  const data = url.searchParams.get("data");
  return { data };
};
