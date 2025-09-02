/*
Copyright 2025 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
export class Dialog {
  private dialogElement: HTMLDialogElement;
  private contentElement: HTMLDivElement;
  private promiseResolve: (value: string) => void = () => {};
  private doc: Document;

  constructor(
    doc: Document,
    private title: string,
    private content: HTMLElement,
    private buttons: string[]
  ) {
    this.doc = doc;
    this.dialogElement = this.doc.createElement('dialog');
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
      const button = this.doc.createElement('button');
      button.textContent = label;
      button.value = label;
      buttonsContainer.appendChild(button);
    }

    this.doc.body.appendChild(this.dialogElement);

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
