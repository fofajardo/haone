import { json } from "@sveltejs/kit";
import { authenticateResident, serverError } from "$lib/server/api-helper";
import { saveImageToFirestore } from "$lib/server/services/firestore-service";

export async function POST({ request, url: reqUrl }) {
  const auth = await authenticateResident(request);
  if (auth.error) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file || !(file instanceof File)) {
      return json({ error: "No file provided" }, { status: 400 });
    }

    // Firestore document limit is 1MB.
    // Base64 adds ~33% overhead, so we limit raw file to ~700KB.
    if (file.size > 700 * 1024) {
      return json({ error: "File too large for Firestore (max 700KB)" }, { status: 400 });
    }

    const id = crypto.randomUUID();

    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < uint8.byteLength; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const base64Data = btoa(binary);
    const dataUri = `data:${file.type};base64,${base64Data}`;

    await saveImageToFirestore(id, dataUri, file.type);

    const origin = reqUrl.origin;
    const publicUrl = `${origin}/api/image/${id}`;

    return json({ url: publicUrl });
  } catch (err: any) {
    return serverError(err.message, "Upload API");
  }
}
