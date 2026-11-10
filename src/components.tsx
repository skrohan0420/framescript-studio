import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useContext, type ReactNode } from "react";
import { EditorStatus } from "./editor-status";
export function Modal({
  title,
  open,
  onClose,
  children,
  headerAction,
  onEscapeKeyDown,
  wide = false,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  headerAction?: ReactNode;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  wide?: boolean;
}) {
  const { announcement } = useContext(EditorStatus);
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content
          className={"modal" + (wide ? " modal-wide" : "")}
          onEscapeKeyDown={onEscapeKeyDown}
        >
          <div className="modal-head">
            <Dialog.Title>{title}</Dialog.Title>
            <div className="modal-head-actions">
              {headerAction}
              <Dialog.Close aria-label="Close">
                <X size={18} />
              </Dialog.Close>
            </div>
          </div>
          <Dialog.Description className="sr-only">
            {title} controls
          </Dialog.Description>
          <span className="sr-only" aria-live="polite">{announcement}</span>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function WorkflowSurface({
  embedded,
  ...props
}: {
  embedded?: boolean;
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return embedded ? (
    <section className="workflow-inline" aria-label="Production tools">
      {props.children}
    </section>
  ) : (
    <Modal {...props} />
  );
}
