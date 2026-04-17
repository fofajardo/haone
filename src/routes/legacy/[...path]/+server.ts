import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = ({ params, url }) => {
  const targetPath = params.path ? `/${params.path}` : "/admin";
  const target = targetPath + url.search;
  throw redirect(308, target);
};
