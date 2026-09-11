<script lang="ts">
  import { pageState } from "$state/page-info.svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { globalDialog } from "$state/dialog.svelte";
  import { type UserRecord, UserTag } from "$lib/types";
  import { fetchUserById, updateUser } from "$api/controllers/resident-controller";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import UserForm from "$components/admin/UserForm.svelte";
  import { Button } from "$ui/button";

  const userId = $derived(page.params.id);

  let user = $state<UserRecord | null>(null);
  let isLoading = $state(true);
  let isSaving = $state(false);
  let error = $state<string | null>(null);

  let formData = $state<Partial<UserRecord>>({});
  let academicItems = $state<{ college: string; program: string }[]>([]);
  let userTypes = $state<string[]>([]);

  function parseAcademic(colStr: string, progStr: string) {
    const cols = (colStr || "").split(",").map((s) => s.trim());
    const progs = (progStr || "").split(":").map((s) => s.trim());
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

  async function handleSave() {
    if (!userId || !user) return;
    isSaving = true;
    try {
      // Sync academic items back to formData
      formData.college = academicItems.map((i) => i.college).join(",");
      formData.program = academicItems.map((i) => i.program).join(":");
      formData.tags = userTypes.join(":");

      await updateUser(userId, formData);
      goto(`/admin/users/${userId}`);
    } catch (e: any) {
      globalDialog.show(
        "Save Failed",
        `An error occurred while trying to save the user data:<div class="mt-2 rounded-md border bg-muted p-3 text-sm text-foreground">${e.message}</div>`
      );
    } finally {
      isSaving = false;
    }
  }

  onMount(() => {
    pageState.title = "Edit User";
    loadUser();
  });
</script>

{#if isLoading}
  <LoadingView />
{:else if error}
  <ErrorView {error}>
    <Button variant="outline" class="mt-4" href="/admin/users">Return to Directory</Button>
  </ErrorView>
{:else if user}
  <UserForm
    bind:formData
    bind:userTypes
    bind:academicItems
    {isSaving}
    onSave={handleSave}
    title="Edit User"
  />
{/if}
