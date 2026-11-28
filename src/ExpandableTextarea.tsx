import * as Dialog from "@radix-ui/react-dialog";
import { Maximize2, X } from "lucide-react";
import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type TextareaHTMLAttributes,
} from "react";

/** Uses the field's existing change handler, so full-screen edits save normally. */
export const ExpandableTextarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function ExpandableTextarea({ value, defaultValue, onChange, ...props }, forwardedRef) {
  const source = useRef<HTMLTextAreaElement>(null);
  const expanded = useRef<HTMLTextAreaElement>(null);
  const selection = useRef({ start: 0, end: 0, scroll: 0 });
  const [open, setOpen] = useState(false);
  const [localValue, setLocalValue] = useState(defaultValue ?? "");
  const [label, setLabel] = useState(props["aria-label"] || "Text");
  useImperativeHandle(forwardedRef, () => source.current!);

  useLayoutEffect(() => {
    const field = source.current;
    if (!field) return;
    const associated = field.labels?.[0];
    const labelledBy = props["aria-labelledby"]?.split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
    const directText = associated && Array.from(associated.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent).join(" ");
    const caption = associated?.querySelector("span")?.cloneNode(true) as HTMLElement | undefined;
    caption?.querySelectorAll("small, button").forEach((node) => node.remove());
    const name = props["aria-label"] || labelledBy
      || caption?.textContent || directText
      || props.placeholder || "Text";
    setLabel(name.replace(/\s+/g, " ").trim().slice(0, 120));
  }, [props["aria-label"], props["aria-labelledby"], props.placeholder]);

  const change = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setLocalValue(event.currentTarget.value);
    onChange?.(event);
  };
  const rememberSelection = (field: HTMLTextAreaElement | null) => {
    if (field) selection.current = {
      start: field.selectionStart, end: field.selectionEnd, scroll: field.scrollTop,
    };
  };
  const restoreSelection = (field: HTMLTextAreaElement | null) => {
    if (!field) return;
    field.focus({ preventScroll: true });
    field.setSelectionRange(selection.current.start, selection.current.end);
    field.scrollTop = selection.current.scroll;
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => {
      rememberSelection(next ? source.current : expanded.current);
      setOpen(next);
    }}>
      <div className="expandable-textarea">
        <textarea {...props} ref={source} value={value ?? localValue} onChange={change}
          style={{ ...props.style, paddingRight: 42 }}
          aria-label={props["aria-label"] || (props["aria-labelledby"] ? undefined : label)} />
        <Dialog.Trigger asChild>
          <button type="button" className="textarea-expand-button"
            aria-label="Expand text field" aria-description={label} title={"Expand " + label}
            disabled={props.disabled} onMouseDown={(event) => event.preventDefault()}>
            <Maximize2 size={15} aria-hidden="true" />
          </button>
        </Dialog.Trigger>
      </div>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay textarea-fullscreen-overlay" />
        <Dialog.Content className="modal textarea-fullscreen-dialog"
          onEscapeKeyDown={(event) => event.stopPropagation()}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            restoreSelection(expanded.current);
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreSelection(source.current);
          }}>
          <div className="textarea-fullscreen-header">
            <div>
              <Dialog.Title>{label}</Dialog.Title>
              <Dialog.Description>
                {props.readOnly ? "Read-only text · Escape to close" : "Edits apply as you type · Escape to close"}
              </Dialog.Description>
            </div>
            <Dialog.Close className="textarea-fullscreen-close" aria-label="Close full-screen text editor">
              <X size={18} aria-hidden="true" /> Close
            </Dialog.Close>
          </div>
          <textarea ref={expanded} className="textarea-fullscreen-input"
            aria-label={label + " (full screen)"} value={value ?? localValue}
            onChange={change} readOnly={props.readOnly} disabled={props.disabled}
            maxLength={props.maxLength} placeholder={props.placeholder}
            spellCheck={props.spellCheck} wrap={props.wrap} dir={props.dir}
            lang={props.lang} autoCapitalize={props.autoCapitalize} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});
