<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import { type UserRecord, UserTag } from "$lib/schemas";
  import { fetchUserById, updateUser } from "$lib/resident-logic";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import UserForm from "$lib/components/admin/UserForm.svelte";

  const userId = $derived(page.params.id);

  let user = $state<UserRecord | null>(null);
  let isLoading = $state(true);
  let isSaving = $state(false);
  let error = $state<string | null>(null);

  let formData = $state<Partial<UserRecord>>({});
  let academicItems = $state<{ college: string; program: string }[]>([]);
  let userTypes = $state<string[]>([]);

  function parseAcademic(colStr: string, progStr: string) {
    const cols = (colStr || "").split(";").map((s) => s.trim());
    const progs = (progStr || "").split(";").map((s) => s.trim());
    const count = Math.max(cols.length, progs.length);
    const items: { college: string; program: string }[] = [];
    for (let i = 0; i < count; i++) {
      if (cols[i] || progs[i]) {
        items.push({ college: cols[i] || "", program: progs[i] || "" });
      }
    }
    return items.length > 0 ? items : [{ college: "", program: "" }];
  }

  async function loadUser() {
    if (!userId) return;
    isLoading = true;
    error = null;
    try {
      user = await fetchUserById(userId);
      if (user) {
        formData = { ...user };
        academicItems = parseAcademic(user.college || "", user.program || "");
        userTypes = (user.tags || "")
          .split(":")
          .map((s) => s.trim())
          .filter(Boolean);
      } else {
        error = "User not found";
      }
    } catch (e: any) {
      console.error(e);
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  let isErrorDialogOpen = $state(false);
  let saveError = $state<string | null>(null);

  async function handleSave() {
    if (!userId || !user) return;
    isSaving = true;
    try {
      // Sync academic items back to formData
      formData.college = academicItems.map((i) => i.college).join(";");
      formData.program = academicItems.map((i) => i.program).join(";");
      formData.tags = userTypes.join(":");

      // Final validation
      if (userTypes.includes(UserTag.STUDENT) && userTypes.includes(UserTag.ALUMNUS)) {
        throw new Error("User cannot be both STUDENT and ALUMNUS at the same time.");
      }

      await updateUser(userId, formData);
      goto(`/admin/users/${userId}`);
    } catch (e: any) {
      saveError = e.message;
      isErrorDialogOpen = true;
    } finally {
      isSaving = false;
    }
  }

  onMount(loadUser);
</script>

<div class="space-y-6">
  <SubpageHeader title="Edit User" />

  {#if isLoading}
    <LoadingView text="Loading user data…" />
  {:else if error}
    <ErrorView {error}>
      <button
        class="mt-4 rounded-md border px-4 py-2 hover:bg-muted"
        onclick={() => goto("/admin/users")}>Return to Directory</button
      >
    </ErrorView>
  {:else if user}
    <UserForm
      bind:formData
      bind:userTypes
      bind:academicItems
      {isSaving}
      onSave={handleSave}
      onCancel={() => goto(`/admin/users/${userId}`)}
      title="Edit {user.displayName}"
    />
  {/if}
</div>

<!-- Save Error AlertDialog -->
<AlertDialog.Root bind:open={isErrorDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Save Failed</AlertDialog.Title>
      <AlertDialog.Description>
        An error occurred while trying to save the user data:
        <div class="mt-2 rounded-md border bg-muted p-3 text-sm text-foreground">
          {saveError}
        </div>
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Action onclick={() => (isErrorDialogOpen = false)}>OK</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
