import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
  return {
    pageInfo: {
      title: "Store Item in Fridge"
    }
  };
};
