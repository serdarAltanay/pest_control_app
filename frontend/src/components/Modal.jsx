import { useEffect } from "react";
import "../styles/Modal.scss";

export default function Modal({ open, title, children, footer, onClose }) {
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose?.();
    if (open) document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ui-modal-backdrop" onMouseDown={onClose}>
      <div
        className="ui-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="ui-modal__head">
          <h3>{title}</h3>
          <button className="ui-modal__close" onClick={onClose} aria-label="Kapat">✕</button>
        </div>

        <div className="ui-modal__body">{children}</div>

        {footer && <div className="ui-modal__foot">{footer}</div>}
      </div>
    </div>
  );
}
