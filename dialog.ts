export class Dialog {
  private dialogElement: HTMLDialogElement;
  private contentElement: HTMLDivElement;
  private promiseResolve: (value: string) => void = () => {};

  constructor(
    private title: string,
    private content: HTMLElement,
    private buttons: string[]
  ) {
    this.dialogElement = document.createElement('dialog');
    this.dialogElement.innerHTML = `
      <form method="dialog">
        <h2>${this.title}</h2>
        <div class="content"></div>
        <div class="buttons"></div>
      </form>
    `;
    this.contentElement = this.dialogElement.querySelector('.content')!;
    this.contentElement.appendChild(this.content);

    const buttonsContainer = this.dialogElement.querySelector('.buttons')!;
    for (const label of this.buttons) {
      const button = document.createElement('button');
      button.textContent = label;
      button.value = label;
      buttonsContainer.appendChild(button);
    }

    document.body.appendChild(this.dialogElement);

    this.dialogElement.addEventListener('close', () => {
      this.promiseResolve(this.dialogElement.returnValue);
      this.dialogElement.remove();
    });
  }

  show(): Promise<string> {
    this.dialogElement.showModal();
    return new Promise<string>((resolve) => {
      this.promiseResolve = resolve;
    });
  }

  close() {
    this.dialogElement.close();
  }
}
