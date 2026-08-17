<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { Button } from "$ui/button";
  import { Save, Trash2 } from "@lucide/svelte";
  import SubpageHeader from "$components/SubpageHeader.svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import {
    fetchOfficers,
    updateOfficer,
    deleteOfficer,
    transitionOfficerPosition
  } from "$api/controllers/officer-controller";
  import type { OfficerRecord } from "$lib/types";
  import { OfficerStatus } from "$lib/types";
  import { toast } from "svelte-sonner";
  import { Label } from "$ui/label";
  import { Input } from "$ui/input";
  import * as Select from "$ui/select";
  import { goto } from "$app/navigation";
  import * as Card from "$ui/card";
  import * as AlertDialog from "$ui/alert-dialog";
  import * as Dialog from "$ui/dialog";
  import { pageState } from "$state/page-info.svelte";
  import { brandingState } from "$state/branding.svelte";
  import { translatePeriod } from "$utils/translators";

  const { id } = page.params;
  let officer = $state<OfficerRecord | null>(null);
  let isLoading = $state(true);
  let isSaving = $state(false);
  let showDeleteDialog = $state(false);
  let showChangePositionDialog = $state(false);
  let newPosition = $state("");

  let editData = $state({
    status: OfficerStatus.ACTIVE,
    position: "",
    nickname: "",
    committee: "",
    fbLink: "",
    birthday: ""
  });

  async function loadData() {
    isLoading = true;
    try {
      const officers = await fetchOfficers();
      const found = officers.find((o) => o.id === id);
      if (!found) {
        toast.error("Officer not found");
        goto("/admin/residents/officers");
        return;
      }
      officer = found;
      editData = {
        status: found.status as OfficerStatus,
        position: found.position,
        nickname: found.nickname,
        committee: found.committee,
        fbLink: found.fbLink,
        birthday: found.birthday
      };
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Edit Officer";
    loadData();
  });

  const availablePositions = $derived(
    (brandingState.profile.officerPositions as { title: string; limit: number }[]) || []
  );

  async function handleUpdate() {
    if (!officer) return;

    if (editData.fbLink) {
      try {
        const url = new URL(editData.fbLink);
        if (
          !url.hostname.includes("facebook.com") &&
          !url.hostname.includes("fb.com") &&
          !url.hostname.includes("fb.me")
        ) {
          toast.error("Please provide a valid Facebook profile link");
          return;
        }
      } catch (e) {
        toast.error("Invalid Facebook link URL");
        return;
      }
    }

    isSaving = true;
    try {
      await updateOfficer(officer.id, {
        status: editData.status,
        nickname: editData.nickname,
        committee: editData.committee,
        fbLink: editData.fbLink,
        birthday: editData.birthday
      });
      toast.success("Officer record updated");
      goto("/admin/residents/officers");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isSaving = false;
    }
  }

  async function handleChangePosition() {
    if (!officer || !newPosition) return;
    isSaving = true;
    try {
      await transitionOfficerPosition(officer.id, newPosition);
      toast.success("Position changed and new record created");
      goto("/admin/residents/officers");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isSaving = false;
      showChangePositionDialog = false;
    }
  }

  async function handleDelete() {
    if (!officer) return;
    isSaving = true;
    try {
      await deleteOfficer(officer.id);
      toast.success("Officer removed");
      goto("/admin/residents/officers");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isSaving = false;
    }
  }

  const statusOptions = [
    { value: OfficerStatus.ACTIVE, label: "Active" },
    { value: OfficerStatus.RESIGNED, label: "Resigned" }
  ];

  const isImmutable = $derived(officer?.status === OfficerStatus.CHANGED_POSITION);
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <SubpageHeader title="Edit Officer" />

  {#if isLoading}
    <LoadingView />
  {:else if officer}
    {#if isImmutable}
      <div
        class="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-600 dark:text-yellow-400"
      >
        This record is read-only because this officer has transitioned to a new position.
      </div>
    {/if}

    <Card.Root class="mx-auto max-w-2xl opacity-{isImmutable ? '70' : '100'}">
      <Card.Header>
        <Card.Title>{officer.name}</Card.Title>
        <Card.Description
          >Update officer details for {translatePeriod(officer.term)}.</Card.Description
        >
      </Card.Header>
      <Card.Content class="space-y-6">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label>Status</Label>
            <Select.Root
              type="single"
              bind:value={editData.status}
              onValueChange={(v) => (editData.status = v as OfficerStatus)}
              disabled={isImmutable}
            >
              <Select.Trigger class="w-full">
                {statusOptions.find((s) => s.value === editData.status)?.label}
              </Select.Trigger>
              <Select.Content>
                {#each statusOptions as option}
                  <Select.Item value={option.value} label={option.label}>
                    {option.label}
                  </Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </div>

          <div class="space-y-2">
            <Label>Position</Label>
            <div class="flex gap-2">
              <Input value={editData.position} readonly class="bg-muted" />
              <Button
                variant="outline"
                onclick={() => (showChangePositionDialog = true)}
                disabled={isImmutable}
              >
                Change
              </Button>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label>Nickname (Optional)</Label>
            <Input bind:value={editData.nickname} placeholder="e.g., Joey" readonly={isImmutable} />
          </div>

          <div class="space-y-2">
            <Label>Committee (Optional)</Label>
            <Input
              bind:value={editData.committee}
              placeholder="e.g., Informaation"
              readonly={isImmutable}
            />
          </div>
        </div>

        <div class="space-y-2">
          <Label>FB Link (Optional)</Label>
          <Input
            bind:value={editData.fbLink}
            placeholder="https://facebook.com/..."
            readonly={isImmutable}
          />
        </div>

        <div class="space-y-2">
          <Label>Birthday (Optional)</Label>
          <Input bind:value={editData.birthday} type="date" readonly={isImmutable} />
        </div>

        <div class="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <h4 class="text-sm font-bold text-destructive">Danger Zone</h4>
          <p class="mt-1 text-muted-foreground">
            Permanently removing an officer will delete their record from the directory.
          </p>
          <Button
            variant="destructive"
            size="sm"
            class="mt-4"
            onclick={() => (showDeleteDialog = true)}
            icon={Trash2}
            disabled={isImmutable}
          >
            Remove Permanently
          </Button>
        </div>
      </Card.Content>
      <Card.Footer class="justify-end gap-2 border-t pt-6">
        <Button variant="ghost" onclick={() => goto("/admin/residents/officers")}>Cancel</Button>
        <Button onclick={handleUpdate} isLoading={isSaving} icon={Save} disabled={isImmutable}>
          Save Changes
        </Button>
      </Card.Footer>
    </Card.Root>
  {/if}
</div>

<Dialog.Root bind:open={showChangePositionDialog}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Change Officer Position</Dialog.Title>
      <Dialog.Description>
        Selecting a new position will mark the current record as "Changed Position" and create a new
        active record for this officer.
      </Dialog.Description>
    </Dialog.Header>
    <div class="space-y-4 py-4">
      <div class="space-y-2">
        <Label>New Position</Label>
        <Select.Root
          type="single"
          bind:value={newPosition}
          onValueChange={(v) => (newPosition = v)}
        >
          <Select.Trigger class="w-full">
            {newPosition || "Select a new position…"}
          </Select.Trigger>
          <Select.Content>
            {#each availablePositions as pos}
              <Select.Item value={pos.title} label={pos.title}>
                {pos.title}
              </Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
    </div>
    <Dialog.Footer>
      <Button variant="ghost" onclick={() => (showChangePositionDialog = false)}>Cancel</Button>
      <Button onclick={handleChangePosition} isLoading={isSaving}>Transition Role</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<AlertDialog.Root bind:open={showDeleteDialog}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Permanent Removal</AlertDialog.Title>
      <AlertDialog.Description>
        This will permanently delete the officer record. This action cannot be undone.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action>
        {#snippet child({ props })}
          <Button {...props} variant="destructive" onclick={handleDelete} isLoading={isSaving}>
            Remove Permanently
          </Button>
        {/snippet}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
