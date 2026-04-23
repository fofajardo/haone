<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { uiSettings } from "$lib/settings.svelte";
  import { type UserRecord as User } from "$lib/schemas";
  import { fetchUsers } from "$lib/resident-logic";
  import { TableSync } from "$lib/components/ui/data-table/table-sync.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Combobox } from "$lib/components/ui/combobox";
  import { Label } from "$lib/components/ui/label";
  import { RefreshCcw, Users, Search, FunnelX } from "lucide-svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import EmptyView from "$lib/components/EmptyView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { Plus, UserPlus, FileUp } from "lucide-svelte";
  import { columns } from "./columns";
  import DataTable from "$lib/components/ui/data-table/data-table.svelte";
  import { translateCollege, translateProgram } from "$lib/receipt-utils";

  let users = $state<User[]>([]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  const tableSync = new TableSync({
    initialFilters: { search: "", college: "ALL", program: "ALL", tags: "ALL" },
    paramMap: { search: "q", college: "college", program: "program", tags: "tags" },
    searchKey: "search"
  });

  async function loadData(forceRefresh = false) {
    if (!uiSettings.residentRecordsId) return;
    isLoading = true;
    error = null;
    try {
      users = await fetchUsers(forceRefresh);
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(loadData);

  const collegeOptions = $derived.by(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      translateCollege(u.college).forEach((c) => {
        if (c && c !== "—") set.add(c);
      });
    });
    return Array.from(set).sort();
  });

  const programOptions = $derived.by(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      translateProgram(u.program).forEach((p) => {
        if (p && p !== "—") set.add(p);
      });
    });
    return Array.from(set).sort();
  });

  const tagsOptions = $derived.by(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      (u.tags || "STUDENT").split(":").forEach((t) => {
        const val = t.trim();
        if (val) set.add(val);
      });
    });
    return Array.from(set).sort();
  });

  const filteredUsers = $derived.by(() => {
    return users
      .filter((u) => {
        const search = tableSync.filters!.search.toLowerCase();
        const college = tableSync.filters!.college;
        const program = tableSync.filters!.program;
        const tags = tableSync.filters!.tags;

        const matchesSearch =
          u.displayName?.toLowerCase().includes(search) ||
          u.email?.toLowerCase().includes(search) ||
          u.studentNo?.toLowerCase().includes(search);

        const matchesCollege =
          college === "ALL" || translateCollege(u.college).some((c) => c === college);

        const matchesProgram =
          program === "ALL" || translateProgram(u.program).some((p) => p === program);

        const matchesTags =
          tags === "ALL" || (u.tags || "STUDENT").split(":").some((t) => t.trim() === tags);

        return matchesSearch && matchesCollege && matchesProgram && matchesTags;
      })
      .sort((a, b) => (a.studentNo || "").localeCompare(b.studentNo || ""));
  });

  function resetFilters() {
    tableSync.reset();
  }
</script>

<div class="space-y-3">
  <SubpageHeader title="Users" isTopLevel={true}>
    {#snippet actions()}
      <div class="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onclick={() => loadData(true)}
          {isLoading}
          icon={RefreshCcw}
        />

        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            {#snippet child({ props })}
              <Button size="sm" {...props} icon={Plus}>Add</Button>
            {/snippet}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item onclick={() => goto("/admin/users/new")}>
              <UserPlus class="mr-2 h-4 w-4" /> Single User
            </DropdownMenu.Item>
            <DropdownMenu.Item onclick={() => goto("/admin/users/batch")}>
              <FileUp class="mr-2 h-4 w-4" /> Batch Import
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>
    {/snippet}
  </SubpageHeader>

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button
        variant="outline"
        size="sm"
        class="mt-2"
        onclick={() => loadData()}
        {isLoading}
        icon={RefreshCcw}>Try Again</Button
      >
    </ErrorView>
  {:else}
    <div class="grid gap-2 lg:grid-cols-12">
      <div class="space-y-1 lg:col-span-4">
        <Label class="text-xs font-bold text-muted-foreground uppercase">Search</Label>
        <div class="relative">
          <Search
            class="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            bind:value={tableSync.filters!.search}
            placeholder="Search users…"
            class="h-9 pl-9 text-xs"
          />
        </div>
      </div>

      <div class="space-y-1 lg:col-span-2">
        <Label class="text-xs font-bold text-muted-foreground uppercase">College</Label>
        <Combobox
          bind:value={tableSync.filters!.college}
          options={[
            { value: "ALL", label: "All Colleges" },
            ...collegeOptions.map((c) => ({ value: c, label: c }))
          ]}
          class="h-9"
        />
      </div>

      <div class="space-y-1 lg:col-span-3">
        <Label class="text-xs font-bold text-muted-foreground uppercase">Program</Label>
        <Combobox
          bind:value={tableSync.filters!.program}
          options={[
            { value: "ALL", label: "All Programs" },
            ...programOptions.map((p) => ({ value: p, label: p }))
          ]}
          class="h-9"
        />
      </div>

      <div class="space-y-1 lg:col-span-2">
        <Label class="text-xs font-bold text-muted-foreground uppercase">Tags</Label>
        <Combobox
          bind:value={tableSync.filters!.tags}
          options={[
            { value: "ALL", label: "All Tags" },
            ...tagsOptions.map((t) => ({ value: t, label: t }))
          ]}
          class="h-9"
        />
      </div>

      <div class="flex items-end lg:col-span-1">
        <Button
          variant="outline"
          size="sm"
          onclick={resetFilters}
          class="mb-1 h-9 w-full px-2"
          icon={FunnelX}
        >
          Clear
        </Button>
      </div>
    </div>

    {#if filteredUsers.length > 0}
      <DataTable
        data={filteredUsers}
        {columns}
        pagination={tableSync.pagination}
        onPaginationChange={(p) => (tableSync.pagination = p)}
        onRowClick={(r) => goto(`/admin/users/${r.id}`)}
        rowId="id"
      />
    {:else}
      <EmptyView title="No users found." description="Try adjusting your filters or search query.">
        {#snippet icon()}
          <Users class="h-8 w-8 text-muted-foreground" />
        {/snippet}
      </EmptyView>
    {/if}
  {/if}
</div>
