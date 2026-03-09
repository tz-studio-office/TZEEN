import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ModalProps = {
  isOpen?: boolean;
  open?: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidthClassName?: string;
  panelClassName?: string;
};

export default function Modal({
  isOpen,
  open,
  onClose,
  title,
  children,
  maxWidthClassName = 'max-w-2xl',
  panelClassName,
}: ModalProps) {
  const visible = typeof isOpen === 'boolean' ? isOpen : Boolean(open);

  useEffect(() => {
    if (!visible) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [visible, onClose]);

  if (!visible || typeof document === 'undefined') return null;

  const panelClasses = panelClassName
    ? `relative z-[1001] ${panelClassName}`
    : `relative z-[1001] w-full ${maxWidthClassName} max-h-[90vh] overflow-hidden rounded-3xl border border-black/10 bg-white shadow-2xl`;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={panelClasses}>
        {title ? <div className="border-b border-black/10 px-6 py-4 text-lg font-semibold text-sand-900">{title}</div> : null}
        {panelClassName ? children : <div className="max-h-[calc(90vh-4rem)] overflow-y-auto px-6 py-5">{children}</div>}
      </div>
    </div>,
    document.body
  );
}
