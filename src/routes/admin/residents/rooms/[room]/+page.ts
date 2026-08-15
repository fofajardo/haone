import type { PageLoad } from "./$types";

export const load: PageLoad = ({ params }) => {
  return {
    roomNumber: params.room,
    pageInfo: {
      title: `Room ${params.room}`
    }
  };
};
