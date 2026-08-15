/**
 * Converts an image URL to a base64 data URL.
 */
export async function imgToDataUrl(url: string): Promise<string> {
  if (!url) {
    return "";
  }
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("Failed to fetch image for PDF:", e);
    return "";
  }
}

/**
 * Loads pdfMake and registers custom fonts dynamically.
 */
export async function getPdfMake() {
  const [pdfMakeMod, pdfFontsMod] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts")
  ]);

  const pdfMake = pdfMakeMod.default;
  const pdfFonts = pdfFontsMod.default;

  const vfs = (pdfFonts as any).pdfMake
    ? (pdfFonts as any).pdfMake.vfs
    : (pdfFonts as any).vfs || pdfFonts;
  (pdfMake as any).vfs = vfs;

  const fontBase = "https://raw.githubusercontent.com/Omnibus-Type/Archivo/master/fonts/ttf";
  (pdfMake as any).addFonts({
    Archivo: {
      normal: `${fontBase}/Archivo-Regular.ttf`,
      bold: `${fontBase}/Archivo-SemiBold.ttf`,
      italics: `${fontBase}/Archivo-Italic.ttf`,
      bolditalics: `${fontBase}/Archivo-SemiBoldItalic.ttf`
    },
    Roboto: {
      normal: "https://unpkg.com/pdfmake@0.3/build/fonts/Roboto/Roboto-Regular.ttf",
      bold: "https://unpkg.com/pdfmake@0.3/build/fonts/Roboto/Roboto-Medium.ttf",
      italics: "https://unpkg.com/pdfmake@0.3/build/fonts/Roboto/Roboto-Italic.ttf",
      bolditalics: "https://unpkg.com/pdfmake@0.3/build/fonts/Roboto/Roboto-MediumItalic.ttf"
    }
  });

  return pdfMake;
}
