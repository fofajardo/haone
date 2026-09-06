class DialogState {
  open = $state(false);
  title = $state("");
  description = $state("");

  show(title: string, description: string) {
    this.title = title;
    this.description = description;
    this.open = true;
  }

  close() {
    this.open = false;
  }
}

export const globalDialog = new DialogState();
