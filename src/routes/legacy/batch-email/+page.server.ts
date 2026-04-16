import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = () => {
  return {
    pageInfo: {
      title: "Email Manager"
    }
  };
};
