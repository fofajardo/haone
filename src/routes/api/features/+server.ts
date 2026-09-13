import { getFeatureFlagValueMulti } from '$api/utils/feature-flags';
import type { RequestEvent, RequestHandler } from './$types';

export const GET: RequestHandler = async (event: RequestEvent) => {
    const params = event.url.searchParams.get("features");

    if (!params) {
        return new Response(JSON.stringify([]));
    }

    const theResponse = new Response(JSON.stringify(getFeatureFlagValueMulti(params.split(";"), null)));
    return theResponse;
};