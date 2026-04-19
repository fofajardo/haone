import type { PageLoad } from "./$types";

export const load: PageLoad = () => {
  return {
    pageInfo: {
      title: "Sign In"
    }
  };
};
