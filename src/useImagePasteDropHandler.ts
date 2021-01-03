import { useEffect } from "react";

function getImageFile(transfer: DataTransfer): File | null {
  for (let i = 0; i < transfer.items.length; i++) {
    const item = transfer.items[i];
    if (item.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }
  return null;

}

export function useImageDropHandler(onImageDrop: (file: File) => void): void {
  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
      const transfer = event.dataTransfer;
      if (transfer === null) {
        return;
      }
      transfer.dropEffect = "copy";
    };

    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      const transfer = event.dataTransfer;
      if (transfer === null) {
        return;
      }
      const file = getImageFile(transfer);
      if (file !== null) {
        onImageDrop(file);
      }
    };

    document.body.addEventListener("dragover", onDragOver);
    document.body.addEventListener("drop", onDrop);

    return () => {
      document.body.removeEventListener("dragover", onDragOver);
      document.body.removeEventListener("drop", onDrop);
    };
  }, [onImageDrop]);
}

export function useImagePasteHandler(onImagePaste: (file: File) => void): void {
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const transfer = event.clipboardData;
      if (transfer === null) {
        return;
      }
      const file = getImageFile(transfer);
      if (file !== null) {
        onImagePaste(file);
      }
    };

    document.body.addEventListener("paste", onPaste);

    return () => {
      document.body.removeEventListener("paste", onPaste);
    };
  }, [onImagePaste]);
}