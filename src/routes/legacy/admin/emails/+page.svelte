<script lang="ts">
  import { onMount } from "svelte";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Table from "$lib/components/ui/table";
  import {
    Upload,
    Mail,
    LogIn,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Play,
    Settings,
    Eye
  } from "lucide-svelte";
  import Papa from "papaparse";
  import branding from "$lib/branding.json";
  import { mailMerge } from "$lib/mail-merge";
  import { loadGisScript, createEmail, sendEmail } from "$lib/gmail";

  let csvData = $state<any[]>([]);
  let headers = $state<string[]>([]);
  let status = $state("");
  let selectedBranding = $state<string>("default");
  let clientId = $state("");
  let accessToken = $state("");
  let isSending = $state(false);
  let progress = $state({ current: 0, total: 0 });
  let error = $state("");
  let emailColumn = $state("ACCOUNT");
  let previewIndex = $state(0);
  let hasReceiptUrl = $state(true);

  const brandingProfiles = Object.keys(branding);
  const currentBranding = $derived(branding[selectedBranding as keyof typeof branding] as any);

  // Sync clientId with branding if explicitly switched
  $effect(() => {
    if (currentBranding.googleClientId) {
      clientId = currentBranding.googleClientId;
    }
  });

  const template = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #000; line-height: 1.5;">
  <div style="margin-bottom: 25px;">
    <img src="{{HEADER_IMAGE_URL}}" width="100%" alt="Header" style="display: block; border: none;">
  </div>

  <h2 style="font-size: 20px; font-weight: bold; text-transform: uppercase; margin-bottom: 25px;">ACKNOWLEDGMENT RECEIPT</h2>

  <p style="margin-bottom: 20px;">Hi, {{ACCOUNT_FULL_NAME}}</p>

  <p style="margin-bottom: 25px;">
    {{TYPE|COLLECTION_OTHERS|Thank you for your payment last {{DATE}}. }}{{TYPE|COLLECTION|Thank you for your payment last {{DATE}}. }}{{TYPE|REFUND|Your payment was refunded. }}{{TYPE|WAIVED|A portion of your semestral fees to the Association has been waived. }}{{TYPE|RECLASSIFY|This is a correction to a previously-issued receipt. }}Please find the acknowledgment receipt linked below for your records.
  </p>

  <div style="text-align: center; margin: 35px 0;">
    <a href="{{RECEIPT_URL}}" style="color: #0047AB; font-size: 24px; font-weight: bold; text-decoration: underline; text-transform: uppercase;">VIEW RECEIPT HERE</a>
  </div>

  <p style="margin-bottom: 20px;">
    We recommend retaining this email for future reference. <strong>Please verify that the amounts listed on the receipt are correct.</strong> The records will be deemed final one week after you receive this email.
  </p>

  <p style="margin-bottom: 25px;">
    For inquiries and comments, please feel free to reach out to the officers in person or contact us at <a href="mailto:{{REPLY_TO}}" style="color: #0047AB;">{{REPLY_TO}}</a>.
  </p>

  <div style="font-size: 12px; color: #777; margin-top: 40px;">
    <p style="margin-bottom: 15px;">This is a system-generated message. When responding to this email, please use the reply address provided (this will be done automatically by Gmail or your email client when you select "Reply").</p>
    
    <p style="font-weight: bold; margin-bottom: 5px;">COMMUNICATION CONFIDENTIALITY NOTICE</p>
    <p style="font-style: italic; line-height: 1.3;">
      This message, its thread, and any attachments are privileged, confidential and intended for the specified recipient only. No part of this message may be shared in any form or manner without the consent of the sender. If you are not the intended recipient of this message, please inform the sender immediately and delete the message from your inbox.
    </p>
  </div>
</div>`;

  async function handleFileUpload(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const text = await file.text();
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        headers = results.meta.fields || [];
        csvData = results.data;
        hasReceiptUrl = headers.includes("RECEIPT_URL");
        if (!hasReceiptUrl) {
          status = "Warning: 'RECEIPT_URL' column is missing! Receipts cannot be viewed.";
        } else {
          status = `Imported ${csvData.length} records.`;
        }
      },
      error: (err: any) => {
        status = `Error parsing CSV: ${err.message}`;
      }
    });
  }

  let tokenClient: any;

  function initGis() {
    if (clientId && (window as any).google) {
      tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/gmail.send",
        callback: (response: any) => {
          if (response.error) {
            error = response.error;
            return;
          }
          accessToken = response.access_token;
          status = "Logged in successfully!";
        }
      });
    }
  }

  onMount(async () => {
    await loadGisScript();
    initGis();
  });

  function handleLogin() {
    if (!clientId) {
      alert("Please provide a Google Client ID");
      return;
    }
    if (!tokenClient) initGis();
    tokenClient.requestAccessToken({ prompt: "consent" });
  }

  async function batchSend() {
    if (!accessToken) {
      alert("Please login first!");
      return;
    }
    if (csvData.length === 0) {
      alert("No data to send!");
      return;
    }
    if (!emailColumn) {
      alert("Please select the email column!");
      return;
    }

    isSending = true;
    error = "";
    progress = { current: 0, total: csvData.length };

    for (const row of csvData) {
      try {
        const recipient = row[emailColumn]?.trim();
        if (!recipient) {
          progress.current++;
          continue;
        }

        const mergedBody = mailMerge(template, {
          ...row,
          ISSUER: currentBranding.issuerName.toUpperCase(),
          REPLY_TO: currentBranding.replyTo,
          HEADER_IMAGE_URL: currentBranding.emailHeaderUrl
        });

        const subject = `Your ${currentBranding.shortName} Receipt PMT-${row.PR_REFNO || row.REFNO || "N/A"}`;
        const raw = createEmail(recipient, subject, mergedBody, currentBranding.replyTo);
        await sendEmail(accessToken, raw);

        progress.current++;
        // Throttling to be safe
        await new Promise((r) => setTimeout(r, 150));
      } catch (e: any) {
        console.error(e);
        error = `Failed at record ${progress.current + 1}: ${e.message}`;
        break;
      }
    }

    isSending = false;
    if (!error) status = `Successfully sent ${progress.current} out of ${progress.total} emails!`;
  }

  function getPreview(data: any) {
    if (!data) return { subject: "", body: "Upload a CSV to see preview." };
    const body = mailMerge(template, {
      ...data,
      ISSUER: currentBranding.issuerName.toUpperCase(),
      REPLY_TO: currentBranding.replyTo,
      HEADER_IMAGE_URL: currentBranding.emailHeaderUrl
    });
    const subject = `Your ${currentBranding.shortName} Receipt PMT-${data.PR_REFNO || data.REFNO || "N/A"}`;
    return { subject, body };
  }

  const currentPreview = $derived(getPreview(csvData[previewIndex]));
</script>

<div class="min-h-screen bg-background p-6 text-foreground md:p-12">
  <div class="mx-auto max-w-5xl space-y-8">
    <header class="flex items-end justify-between border-b pb-6">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Email Manager</h1>
        <p class="text-muted-foreground">Send generated receipts via Gmail API.</p>
      </div>
    </header>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Import & Config -->
      <div class="space-y-6 lg:col-span-1">
        <Card.Root>
          <Card.Header>
            <Card.Title class="flex items-center gap-2 text-lg">
              <Upload class="h-5 w-5" />
              Import Data
            </Card.Title>
          </Card.Header>
          <Card.Content class="space-y-4">
            <div class="group relative">
              <input
                type="file"
                accept=".csv"
                onchange={handleFileUpload}
                class="absolute inset-0 z-10 cursor-pointer opacity-0"
              />
              <div
                class="rounded-lg border-2 border-dashed p-6 text-center transition-all group-hover:bg-muted/50"
              >
                <Upload class="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                <p class="text-xs font-medium">Click to select Receipt Export CSV</p>
              </div>
            </div>
          </Card.Content>
        </Card.Root>

        <Card.Root>
          <Card.Header>
            <Card.Title class="flex items-center gap-2 text-lg">
              <Settings class="h-5 w-5" />
              Settings
            </Card.Title>
          </Card.Header>
          <Card.Content class="space-y-4">
            <div class="space-y-2">
              <Label class="text-xs">Branding Profile</Label>
              <select
                bind:value={selectedBranding}
                class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {#each brandingProfiles as profile}
                  <option value={profile}>{(branding as any)[profile]?.name || profile}</option>
                {/each}
              </select>
            </div>

            <div class="space-y-2">
              <Label class="text-xs">Google Client ID</Label>
              <Input
                type="text"
                bind:value={clientId}
                placeholder="GCP OAuth Client ID"
                class="h-9 text-xs"
              />
              <p class="text-[10px] text-muted-foreground">
                Configured in <code>branding.json</code>.
              </p>
            </div>
          </Card.Content>
          <Card.Footer>
            {#if !accessToken}
              <Button onclick={handleLogin} class="w-full" variant="outline" disabled={!clientId}>
                <LogIn class="mr-2 h-4 w-4" />
                Login with Google
              </Button>
            {:else}
              <div
                class="flex w-full items-center justify-center gap-2 rounded-md bg-primary/10 p-2 text-xs font-semibold text-primary"
              >
                <CheckCircle2 class="h-4 w-4" />
                Authenticated
              </div>
            {/if}
          </Card.Footer>
        </Card.Root>
      </div>

      <!-- Preview & Send -->
      <div class="space-y-6 lg:col-span-2">
        <Card.Root>
          <Card.Header class="flex flex-row items-center justify-between">
            <Card.Title class="flex items-center gap-2 text-lg">
              <Eye class="h-5 w-5" />
              Email Preview
            </Card.Title>
            <div class="flex items-center gap-2">
              {#if csvData.length > 1}
                <div class="mr-4 flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    class="h-7 w-7"
                    disabled={previewIndex === 0}
                    onclick={() => previewIndex--}
                  >
                    <span class="sr-only">Previous</span>
                    <span aria-hidden="true">&lsaquo;</span>
                  </Button>
                  <span class="text-[10px] tabular-nums">
                    {previewIndex + 1} / {csvData.length}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    class="h-7 w-7"
                    disabled={previewIndex === csvData.length - 1}
                    onclick={() => previewIndex++}
                  >
                    <span class="sr-only">Next</span>
                    <span aria-hidden="true">&rsaquo;</span>
                  </Button>
                </div>
              {/if}
              {#if csvData.length > 0}
                <Button
                  onclick={batchSend}
                  disabled={isSending || !accessToken || !hasReceiptUrl}
                  size="sm"
                  class="bg-primary text-primary-foreground"
                >
                  {#if isSending}
                    <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  {:else}
                    <Play class="mr-2 h-4 w-4" />
                    Run Batch
                  {/if}
                </Button>
              {/if}
            </div>
          </Card.Header>
          <Card.Content>
            {#if isSending}
              <div class="mb-4 space-y-2">
                <div class="flex items-center justify-between text-xs">
                  <span>Sending Progress</span>
                  <span>{progress.current} / {progress.total}</span>
                </div>
                <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    class="h-full bg-primary transition-all duration-300"
                    style="width: {(progress.current / progress.total) * 100}%"
                  ></div>
                </div>
              </div>
            {/if}

            <div class="space-y-4">
              <div class="rounded-md border bg-muted/20 p-3">
                <p class="text-[10px] tracking-widest text-muted-foreground uppercase">Subject</p>
                <p class="text-xs font-semibold">{currentPreview.subject}</p>
              </div>
              <div class="rounded-lg border bg-white p-6 whitespace-normal">
                {@html currentPreview.body}
              </div>
            </div>
          </Card.Content>
        </Card.Root>

        {#if status || error || !hasReceiptUrl || !clientId}
          <div
            class={`flex animate-in items-center gap-3 rounded-lg border p-4 text-sm fade-in slide-in-from-top-2 ${
              error || !hasReceiptUrl || !clientId
                ? "border-destructive/20 bg-destructive/10 text-destructive"
                : "border-primary/20 bg-primary/10 text-primary"
            }`}
          >
            {#if error || !hasReceiptUrl || !clientId}
              <AlertCircle class="h-5 w-5" />
            {:else}
              <CheckCircle2 class="h-5 w-5" />
            {/if}
            <span class="font-medium">
              {#if error}{error}
              {:else if !hasReceiptUrl}Missing 'RECEIPT_URL' column. Please use the CSV generated by
                the Receipt Manager.
              {:else if !clientId}Warning: No Google Client ID configured for this profile in <code
                  >branding.json</code
                >.
              {:else}{status}
              {/if}
            </span>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
