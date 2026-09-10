export const pageState = $state({
  title: "",
  isTopLevel: true
});

export const filterState = $state<{
  open: boolean;
  activeCount: number;
}>({
  open: false,
  activeCount: 0
});
