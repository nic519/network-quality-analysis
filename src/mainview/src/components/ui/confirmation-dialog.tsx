import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Button } from "./button";

export function ConfirmationDialog({
  open,
  title,
  description,
  detail,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm"
      role="presentation"
      onClick={onCancel}
    >
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-dialog-title"
        className="w-full max-w-md border-destructive/25 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <CardHeader className="pb-4">
          <CardTitle id="confirmation-dialog-title">{title}</CardTitle>
          {detail ? <CardDescription className="break-all text-xs">{detail}</CardDescription> : null}
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent className="flex items-center justify-end gap-2">
          <Button
            type="button"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            {confirmLabel ?? "确认"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            {cancelLabel ?? "取消"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  return typeof document === "undefined" ? content : createPortal(content, document.body);
}
