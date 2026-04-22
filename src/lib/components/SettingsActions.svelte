<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { LoaderCircle, Save } from "lucide-svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { auth } from "$lib/auth.svelte";
  import { fetchUsers } from "$lib/resident-logic";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";

  let isSaving = $state(false);
  let residentId = $state("");

  async function save() {
    isSaving = true;
    try {
      const id = residentId || auth.user?.email || "";
      await uiSettings.save(id);
      toast.success("Settings saved to account");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isSaving = false;
    }
  }

  onMount(async () => {
    if (auth.authType === "admin") {
      const users = await fetchUsers();
      const me = users.find(
        (u) => u.email.toLowerCase() === (auth.user?.email || "").toLowerCase()
      );
      residentId = me?.id || "";
    }
  });
</script>

<Button size="lg" onclick={save} disabled={isSaving} class="w-full font-bold">
  {#if isSaving}
    <LoaderCircle class="mr-2 h-5 w-5 animate-spin" />
    Saving
  {:else}
    <Save class="mr-2 h-5 w-5" />
    Save
  {/if}
</Button>
