import { authenticateResident } from "$api/services/auth-service";
import { serverError } from "$api/services/server-google-service";
import { uploadImageToStorage } from "$api/services/storage-service";
import { json } from "@sveltejs/kit";

export async function POST({ request, url: reqUrl }) {
  const auth = await authenticateResident(request);
  if (auth.error) {
    return auth.error;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file || !(file instanceof File)) {
      return json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return json({ error: "File too large (max 5MB)" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const arrayBuffer = await file.arrayBuffer();

    await uploadImageToStorage(id, arrayBuffer, file.type);

    const origin = reqUrl.origin;
    const publicUrl = `${origin}/api/image/${id}`;

    return json({ url: publicUrl });
  } catch (err: any) {
    return serverError(err.message, "Upload API");
  }
}
