<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { Textarea } from "$ui/textarea";
  import { Badge } from "$ui/badge";
  import * as RadioGroup from "$ui/radio-group";
  import * as Card from "$ui/card";
  import {
    FridgeCompartment,
    type FridgeItemRecord,
    type ResidentRecord,
    FridgeTag,
    FRIDGE_TAG_LABELS,
    FRIDGE_TAG_LIST
  } from "$lib/types";
  import {
    addFridgeItem,
    updateFridgeItem,
    fetchFridgeItems
  } from "$api/controllers/fridge-controller";
  import { fetchResidents } from "$api/controllers/resident-controller";
  import { compressImage } from "$utils/image-utils";
  import { fetchServer } from "$utils/api-client";
  import { uiSettings } from "$state/settings.svelte";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";
  import { TagsInput } from "$ui/tags-input";
  import SubpageHeader from "$components/SubpageHeader.svelte";
  import AccountAutocomplete from "$components/AccountAutocomplete.svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import {
    Snowflake,
    Refrigerator,
    Upload,
    Trash2,
    Save,
    Tag as TagIcon,
    Package,
    FileText,
    User
  } from "@lucide/svelte";

  let {
    itemId = null as string | null,
    isAdmin = false
  }: {
    itemId?: string | null;
    isAdmin?: boolean;
  } = $props();

  let isLoading = $state(true);
  let isSubmitting = $state(false);
  let isUploading = $state(false);
  let error = $state<string | null>(null);
  let pendingFile = $state<File | Blob | null>(null);
  let previewUrl = $state<string | null>(null);
  let fileInput = $state<HTMLInputElement>();
  let accounts = $state<ResidentRecord[]>([]);
  let residentSearch = $state("");
  let selectedResident = $state<ResidentRecord | null>(null);

  let formData = $state({
    residentId: "",
    residentName: "",
    residentStNo: "",
    name: "",
    compartment: FridgeCompartment.REFRIGERATOR as FridgeCompartment,
    locationDetails: "",
    dateStored: new Date().toISOString().split("T")[0],
    expiryDate: "",
    photoUrl: "",
    notes: "",
    tags: [] as string[]
  });

  const returnUrl = $derived(isAdmin ? "/admin/fridge" : "/resident/fridge");

  function selectAccount(a: ResidentRecord) {
    formData.residentId = a.residentId || a.id;
    formData.residentName = a.name;
    formData.residentStNo = a.stno;
    residentSearch = a.name;
    selectedResident = a;
  }

  onMount(async () => {
    isLoading = true;
    error = null;
    try {
      if (isAdmin) {
        accounts = await fetchResidents(false, uiSettings.currentTerm);
      }

      if (itemId) {
        const res = await fetchFridgeItems();
        const item = res.items.find((i) => i.id === itemId);
        if (!item) {
          error = "Fridge item not found.";
          return;
        }
        formData = {
          residentId: item.residentId || "",
          residentName: item.residentName || "",
          residentStNo: "",
          name: item.name,
          compartment: (item.compartment as FridgeCompartment) || FridgeCompartment.REFRIGERATOR,
          locationDetails: item.locationDetails || "",
          dateStored: item.dateStored || new Date().toISOString().split("T")[0],
          expiryDate: item.expiryDate || "",
          photoUrl: item.photoUrl || "",
          notes: item.notes || "",
          tags: item.tags || []
        };
        previewUrl = item.photoUrl || null;
        if (isAdmin && item.residentId) {
          const matched = accounts.find(
            (a) => (a.residentId && a.residentId === item.residentId) || a.id === item.residentId
          );
          if (matched) {
            selectAccount(matched);
          }
        }
      }
    } catch (e: any) {
      error = e.message || "Failed to load item data.";
    } finally {
      isLoading = false;
    }
  });

  const allFridgeTags = FRIDGE_TAG_LIST;

  function validateTag(val: string, tags: string[]) {
    const transformed = val.trim().toUpperCase();
    if (!transformed) {
      return undefined;
    }
    if (tags.includes(transformed)) {
      return undefined;
    }
    return transformed;
  }

  async function handleFileUpload(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      isUploading = true;
      try {
        const processedFile = await compressImage(file);
        pendingFile = processedFile;
        if (previewUrl && !formData.photoUrl.startsWith("http")) {
          URL.revokeObjectURL(previewUrl);
        }
        previewUrl = URL.createObjectURL(processedFile);
        formData.photoUrl = "PENDING_UPLOAD";
      } catch (err: any) {
        toast.error("File processing failed: " + err.message);
      } finally {
        isUploading = false;
      }
    }
  }

  function handleRemoveImage() {
    if (previewUrl && !formData.photoUrl.startsWith("http")) {
      URL.revokeObjectURL(previewUrl);
    }
    pendingFile = null;
    previewUrl = null;
    formData.photoUrl = "";
  }

  async function handleSubmit() {
    if (isAdmin && !formData.residentId) {
      toast.error("Please select a resident for this item.");
      return;
    }

    if (!formData.name.trim()) {
      toast.error("Please enter an item name.");
      return;
    }

    isSubmitting = true;
    try {
      let finalPhotoUrl = formData.photoUrl;

      if (pendingFile) {
        const formDataUpload = new FormData();
        formDataUpload.append("file", pendingFile, "fridge_item.jpg");
        const data = await fetchServer("/api/upload?type=fridge", {
          method: "POST",
          body: formDataUpload
        });
        finalPhotoUrl = data.url;
      }

      if (itemId) {
        await updateFridgeItem(itemId, {
          ...formData,
          photoUrl: finalPhotoUrl === "PENDING_UPLOAD" ? "" : finalPhotoUrl
        });
        toast.success("Fridge item updated!");
      } else {
        await addFridgeItem({
          ...formData,
          photoUrl: finalPhotoUrl === "PENDING_UPLOAD" ? "" : finalPhotoUrl
        });
        toast.success("Item added to fridge!");
      }

      goto(returnUrl);
    } catch (e: any) {
      toast.error(e.message || "Failed to save fridge item.");
      isSubmitting = false;
    }
  }
</script>

<div class="mx-auto max-w-7xl space-y-3 pb-16">
  <SubpageHeader title={itemId ? "Edit Fridge Item" : "Store Item in Fridge"} href={returnUrl} />

  <div class="mx-auto max-w-3xl space-y-6">
    {#if isLoading}
      <LoadingView />
    {:else if error}
      <ErrorView {error}>
        <Button variant="outline" href={returnUrl}>Go Back</Button>
      </ErrorView>
    {:else}
      <Card.Root>
        <Card.Content class="space-y-6">
          {#if isAdmin}
            <!-- Resident Selector for Admin -->
            <div class="space-y-4">
              <Label
                class="flex items-center gap-2 text-xs font-bold tracking-widest text-foreground uppercase"
              >
                <User class="h-3.5 w-3.5" /> Resident Owner
              </Label>
              <div class="relative space-y-3">
                <AccountAutocomplete
                  label="Owner"
                  placeholder="Search resident email or name…"
                  {accounts}
                  filter={(a) => !uiSettings.currentTerm || a.period === uiSettings.currentTerm}
                  bind:value={residentSearch}
                  onSelect={selectAccount}
                  disabled={isSubmitting}
                />
                <div
                  class="flex items-center justify-between rounded-lg border border-dashed border-muted bg-muted/20 p-3"
                >
                  <div class="flex flex-col">
                    <span
                      class="mb-1 text-xs leading-none font-bold text-muted-foreground uppercase"
                      >Current Selection</span
                    >
                    <span class="text-xs font-bold text-foreground/80"
                      >{formData.residentName || "None selected"}</span
                    >
                    {#if formData.residentStNo}
                      <span class="mt-0.5 font-mono text-xs text-muted-foreground"
                        >{formData.residentStNo}</span
                      >
                    {/if}
                  </div>
                </div>
              </div>
            </div>
          {/if}

          <!-- Item Information -->
          <div class="space-y-4 {isAdmin ? 'border-t pt-4' : ''}">
            <Label
              class="flex items-center gap-2 text-xs font-bold tracking-widest text-foreground uppercase"
            >
              <Package class="h-3.5 w-3.5" /> Item Information
            </Label>

            <div class="space-y-2">
              <Label for="item-name">Item Name</Label>
              <Input
                id="item-name"
                placeholder="e.g., Milk carton, Leftover pasta, Apples"
                bind:value={formData.name}
                disabled={isSubmitting}
              />
            </div>

            <div class="space-y-2">
              <Label>Compartment</Label>
              <RadioGroup.Root
                value={formData.compartment}
                onValueChange={(v) => (formData.compartment = v as FridgeCompartment)}
                class="grid grid-cols-2 gap-4"
              >
                <RadioGroup.Card
                  value={FridgeCompartment.REFRIGERATOR}
                  title="Refrigerator"
                  description="Main/lower fresh food section"
                  icon={Refrigerator}
                  selected={formData.compartment === FridgeCompartment.REFRIGERATOR}
                />
                <RadioGroup.Card
                  value={FridgeCompartment.FREEZER}
                  title="Freezer"
                  description="Upper frozen food section"
                  icon={Snowflake}
                  selected={formData.compartment === FridgeCompartment.FREEZER}
                />
              </RadioGroup.Root>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <Label for="location-details">Location/Shelf</Label>
                <Input
                  id="location-details"
                  placeholder="e.g., 2nd shelf, Door bin"
                  bind:value={formData.locationDetails}
                  disabled={isSubmitting}
                />
              </div>

              <div class="space-y-2">
                <Label for="expiry-date">Expiry Date</Label>
                <Input
                  id="expiry-date"
                  type="date"
                  bind:value={formData.expiryDate}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          <!-- Tags / Classifications -->
          <div class="space-y-2 border-t pt-4">
            <Label
              for="tags"
              class="flex items-center gap-2 text-xs font-bold tracking-widest text-foreground uppercase"
            >
              <TagIcon class="h-3.5 w-3.5" /> Tags & Classifications
            </Label>
            <TagsInput
              id="tags"
              bind:value={formData.tags}
              suggestions={allFridgeTags}
              validate={validateTag}
              formatLabel={(tag) => FRIDGE_TAG_LABELS[tag] || tag}
              filterSuggestions={(input, suggestions) => {
                const lower = input.toLowerCase();
                return suggestions.filter((s) => {
                  const label = (FRIDGE_TAG_LABELS[s] || s).toLowerCase();
                  return s.toLowerCase().includes(lower) || label.includes(lower);
                });
              }}
              placeholder="Add tags…"
              disabled={isSubmitting}
            />
            <p class="text-xs text-muted-foreground italic">
              Press enter to add custom tags or choose from suggestions.
            </p>
          </div>

          <!-- Photo & Notes -->
          <div class="space-y-4 border-t pt-4">
            <Label
              class="flex items-center gap-2 text-xs font-bold tracking-widest text-foreground uppercase"
            >
              <FileText class="h-3.5 w-3.5" /> Additional Details
            </Label>

            {#if uiSettings.firebaseEnabled}
              <div class="space-y-2">
                <Label>Item Photo</Label>
                {#if previewUrl}
                  <div
                    class="relative mx-auto max-w-xs overflow-hidden rounded-xl border border-muted bg-muted/20"
                  >
                    <img
                      src={previewUrl}
                      alt="Item preview"
                      class="aspect-video w-full object-cover"
                    />
                    <div
                      class="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity hover:opacity-100"
                    >
                      <Button
                        size="sm"
                        variant="destructive"
                        onclick={handleRemoveImage}
                        class="h-8 gap-2 px-3 shadow-lg"
                      >
                        <Trash2 class="h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                {:else}
                  <div
                    role="button"
                    tabindex="0"
                    onclick={() => fileInput?.click()}
                    onkeydown={(e) => {
                      if (e.key === "Enter" || e.key === " ") fileInput?.click();
                    }}
                    class="mx-auto flex max-w-md cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted p-6 text-center transition-colors hover:border-border hover:bg-muted/30"
                  >
                    <input
                      type="file"
                      accept="image/*"
                      class="hidden"
                      bind:this={fileInput}
                      onchange={handleFileUpload}
                    />
                    <Upload class="h-6 w-6 text-muted-foreground" />
                    <div class="text-xs text-muted-foreground">
                      <span class="font-medium text-foreground">Click to upload photo</span> or take picture
                    </div>
                  </div>
                {/if}
              </div>
            {/if}

            <div class="space-y-2">
              <Label for="item-notes">Notes</Label>
              <Textarea
                id="item-notes"
                placeholder="e.g., Free to share, Do not open, etc."
                bind:value={formData.notes}
                disabled={isSubmitting}
                rows={3}
              />
            </div>
          </div>

          <div class="flex justify-end pt-2">
            <Button onclick={handleSubmit} isLoading={isSubmitting || isUploading} icon={Save}>
              {itemId ? "Save Changes" : "Store in Fridge"}
            </Button>
          </div>
        </Card.Content>
      </Card.Root>
    {/if}
  </div>
</div>
