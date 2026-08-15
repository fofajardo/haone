<script lang="ts">
  import { onMount, tick } from "svelte";
  import QRCode from "qrcode";
  import html2canvas from "html2canvas";
  import { brandingState } from "$state/branding.svelte";

  import * as AlertDialog from "$ui/alert-dialog";
  import StudentNumberAuthCard from "$components/StudentNumberAuthCard.svelte";
  import ReceiptErrorCard from "$components/receipt/ReceiptErrorCard.svelte";
  import ClearanceWebView from "$components/residents/ClearanceWebView.svelte";
  import ClearanceExportTemplate from "$components/residents/ClearanceExportTemplate.svelte";

  import { LS_KEYS } from "$lib/constants";
  import { pageState } from "$state/page-info.svelte";
  import { exportClearancePDF } from "$reports/clearance-pdf";
  import type { PageData, ActionData } from "./$types";
  import { enhance } from "$app/forms";

  let { data, form } = $props<{ data: PageData; form: ActionData }>();

  let clearanceData = $state<any>(null);
  let error = $state("");
  let studentNo = $state("");
  let rememberMe = $state(false);
  let isChecking = $state(false);
  let qrDataUrl = $state("");
  let isExporting = $state(false);

  // AlertDialog State
  let alertState = $state({ open: false, title: "", description: "" });

  $effect(() => {
    if (form?.success) {
      clearanceData = form.clearanceData;
    } else if (data.clearanceData) {
      clearanceData = data.clearanceData;
    }
    if (data.error) error = data.error;
  });

  $effect(() => {
    if (clearanceData) {
      const profile = brandingState.profile;
      pageState.title = `${profile.issuerName} - Certificate of Full Payment`;

      QRCode.toDataURL(window.location.href, {
        margin: 1,
        width: 200,
        color: { dark: "#000000", light: "#ffffff" }
      }).then((url) => (qrDataUrl = url));
    }
  });

  function showAlert(title: string, description: string) {
    alertState.title = title;
    alertState.description = description;
    alertState.open = true;
  }

  onMount(async () => {
    const savedId = localStorage.getItem(LS_KEYS.STUDENT_NUMBER);
    if (savedId) {
      studentNo = savedId;
      rememberMe = true;
    }

    const handedOffId = sessionStorage.getItem(`clearance_handoff_${data.id}`);
    if (handedOffId) {
      studentNo = handedOffId;
      sessionStorage.removeItem(`clearance_handoff_${data.id}`);
      await tick();
      const formEl = document.getElementById("auth-form") as HTMLFormElement;
      if (formEl) formEl.requestSubmit();
    }
  });

  async function generateCanvas(element: HTMLElement) {
    const images = Array.from(element.querySelectorAll("img"));
    await Promise.all(
      images.map(
        (i) =>
          new Promise((r) => {
            if (i.complete) {
              r(null);
            } else {
              i.onload = r;
              i.onerror = r;
            }
          })
      )
    );

    await tick();
    await new Promise((r) => setTimeout(r, 400));

    return await html2canvas(element, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: 800
    });
  }

  async function downloadPDF() {
    if (!clearanceData) return;
    isExporting = true;
    try {
      await exportClearancePDF({
        name: clearanceData.name,
        period: clearanceData.period,
        refNo: clearanceData.refNo,
        brandingKey: clearanceData.branding,
        signatory: clearanceData.signatory,
        signatoryTitle: clearanceData.signatoryTitle,
        qrDataUrl: qrDataUrl
      });
    } catch (e: any) {
      console.error("PDF export failed:", e);
      showAlert("Export Error", `The PDF generation failed: ${e.message}`);
    } finally {
      isExporting = false;
    }
  }

  async function downloadImage() {
    const templateElement = document.getElementById("export-template");
    if (!templateElement) {
      showAlert("Export Error", "Export template content not found.");
      return;
    }

    isExporting = true;
    try {
      const canvas = await generateCanvas(templateElement);
      const imgData = canvas.toDataURL("image/png");

      const link = document.createElement("a");
      link.href = imgData;
      link.download = `Clearance_${clearanceData.refNo}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e: any) {
      console.error("Export failed:", e);
      showAlert("Export Error", `The image generation failed: ${e.message}`);
    } finally {
      isExporting = false;
    }
  }

  async function shareLink() {
    if (!clearanceData) return;
    const shareData = {
      title: "Certificate of Full Payment",
      text: `Clearance for ${clearanceData.name}`,
      url: window.location.href
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== "AbortError") console.error("Share failed:", err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        showAlert("Link Copied", "The clearance link has been copied to your clipboard.");
      } catch (err) {
        console.error("Clipboard copy failed:", err);
      }
    }
  }

  async function shareQRCode() {
    if (!qrDataUrl || !clearanceData) return;
    try {
      const response = await fetch(qrDataUrl);
      const blob = await response.blob();
      const file = new File([blob], `QR_Clearance_${clearanceData.refNo}.png`, {
        type: "image/png"
      });

      const shareData = {
        files: [file],
        title: "Verification QR Code",
        text: `Scan to verify clearance certificate ${clearanceData.refNo}`
      };

      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        throw new Error("Sharing not supported");
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const link = document.createElement("a");
        link.href = qrDataUrl;
        link.download = `QR_Clearance_${clearanceData.refNo}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  }
</script>

<main
  class="flex min-h-screen items-center justify-center bg-background p-4 text-foreground md:p-8"
>
  {#if !clearanceData && !error}
    <form
      id="auth-form"
      method="POST"
      action="?/verify"
      class="w-full max-w-sm"
      use:enhance={() => {
        isChecking = true;
        return async ({ result, update }) => {
          isChecking = false;
          if (result.type === "success") {
            if (rememberMe) {
              localStorage.setItem(LS_KEYS.STUDENT_NUMBER, studentNo);
            } else {
              localStorage.removeItem(LS_KEYS.STUDENT_NUMBER);
            }
          } else if (result.type === "failure") {
            error = (result.data as any)?.error || "Verification failed";
          }
          await update();
        };
      }}
    >
      <input type="hidden" name="stno" value={studentNo} />
      <input type="hidden" name="remember" value={rememberMe ? "on" : ""} />
      <StudentNumberAuthCard
        bind:studentNo
        bind:rememberMe
        isDecrypting={isChecking}
        onAuthenticate={() => {
          const form = document.getElementById("auth-form") as HTMLFormElement;
          if (form) form.requestSubmit();
        }}
      />
    </form>
  {:else if error}
    <ReceiptErrorCard
      {error}
      onRetry={() => {
        error = "";
        clearanceData = null;
      }}
    />
  {:else if clearanceData}
    <ClearanceWebView
      {clearanceData}
      {qrDataUrl}
      {isExporting}
      onDownloadPDF={downloadPDF}
      onDownloadImage={downloadImage}
      onShareLink={shareLink}
      onShareQR={shareQRCode}
    />
    <ClearanceExportTemplate {clearanceData} {qrDataUrl} />
  {/if}
</main>

<AlertDialog.Root bind:open={alertState.open}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{alertState.title}</AlertDialog.Title>
      <AlertDialog.Description>
        {alertState.description}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Action onclick={() => (alertState.open = false)}>OK</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
