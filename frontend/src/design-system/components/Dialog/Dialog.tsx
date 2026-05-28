import {
  cloneElement,
  createContext,
  forwardRef,
  isValidElement,
  useContext,
  useId,
  useState,
} from 'react';
import type { HTMLAttributes, ReactElement, ReactNode, Ref } from 'react';
import {
  FloatingFocusManager,
  FloatingOverlay,
  FloatingPortal,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useMergeRefs,
  useRole,
  useTransitionStyles,
} from '@floating-ui/react';
import './Dialog.css';

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl';

interface DialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  refs: ReturnType<typeof useFloating>['refs'];
  context: ReturnType<typeof useFloating>['context'];
  getReferenceProps: ReturnType<typeof useInteractions>['getReferenceProps'];
  getFloatingProps: ReturnType<typeof useInteractions>['getFloatingProps'];
  titleId: string;
  descriptionId: string;
  size: DialogSize;
  closeOnOverlayClick: boolean;
}

const DialogContext = createContext<DialogContextValue | null>(null);

const useDialogContext = () => {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('Dialog.* must be used inside <Dialog>');
  return ctx;
};

export interface DialogProps {
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  size?: DialogSize;
  /** オーバーレイクリックで閉じるか */
  closeOnOverlayClick?: boolean;
}

export const Dialog = ({
  children,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  size = 'md',
  closeOnOverlayClick = true,
}: DialogProps) => {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const open = openProp ?? uncontrolled;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setUncontrolled(next);
    onOpenChange?.(next);
  };

  const data = useFloating({ open, onOpenChange: setOpen });
  const click = useClick(data.context);
  const dismiss = useDismiss(data.context, {
    outsidePress: closeOnOverlayClick,
    escapeKey: true,
  });
  const role = useRole(data.context, { role: 'dialog' });
  const interactions = useInteractions([click, dismiss, role]);

  const baseId = useId();
  const value: DialogContextValue = {
    open,
    setOpen,
    refs: data.refs,
    context: data.context,
    getReferenceProps: interactions.getReferenceProps,
    getFloatingProps: interactions.getFloatingProps,
    titleId: `ds-dialog-title-${baseId}`,
    descriptionId: `ds-dialog-desc-${baseId}`,
    size,
    closeOnOverlayClick,
  };

  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
};

// ── Trigger ──
const Trigger = ({ children }: { children: ReactElement }) => {
  const ctx = useDialogContext();
  const child = isValidElement(children) ? children : null;
  const childRef = (child as unknown as { ref?: Ref<HTMLElement> } | null)?.ref;
  const mergedRef = useMergeRefs([ctx.refs.setReference, childRef ?? null]);
  if (!child) return null;
  return cloneElement(child as ReactElement<Record<string, unknown>>, {
    ref: mergedRef,
    ...ctx.getReferenceProps(child.props as Record<string, unknown>),
  });
};

// ── Content ──
export interface DialogContentProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}
const Content = forwardRef<HTMLDivElement, DialogContentProps>(function DialogContent(
  { children, className, ...rest },
  ref,
) {
  const ctx = useDialogContext();
  const mergedRef = useMergeRefs([ctx.refs.setFloating, ref]);

  const { isMounted, styles } = useTransitionStyles(ctx.context, {
    duration: { open: 300, close: 200 },
    initial: { opacity: 0, transform: 'translateY(8px) scale(0.97)' },
  });
  const { isMounted: overlayMounted, styles: overlayStyles } = useTransitionStyles(ctx.context, {
    duration: { open: 200, close: 150 },
    initial: { opacity: 0 },
  });

  if (!isMounted && !overlayMounted) return null;

  return (
    <FloatingPortal>
      <FloatingOverlay
        className="ds-dialog__overlay"
        style={overlayStyles}
        lockScroll
      >
        <FloatingFocusManager context={ctx.context}>
          <div
            ref={mergedRef}
            className={['ds-dialog', `ds-dialog--${ctx.size}`, className].filter(Boolean).join(' ')}
            style={styles}
            aria-labelledby={ctx.titleId}
            aria-describedby={ctx.descriptionId}
            {...ctx.getFloatingProps(rest)}
          >
            {children}
          </div>
        </FloatingFocusManager>
      </FloatingOverlay>
    </FloatingPortal>
  );
});

// ── Header / Title / Body / Footer ──
const Header = ({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div className={['ds-dialog__header', className].filter(Boolean).join(' ')} {...rest}>
    {children}
  </div>
);

const Title = ({ className, children, ...rest }: HTMLAttributes<HTMLHeadingElement>) => {
  const ctx = useDialogContext();
  return (
    <h2
      id={ctx.titleId}
      className={['ds-dialog__title', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </h2>
  );
};

const Description = ({ className, children, ...rest }: HTMLAttributes<HTMLParagraphElement>) => {
  const ctx = useDialogContext();
  return (
    <p
      id={ctx.descriptionId}
      className={['ds-dialog__description', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </p>
  );
};

const Body = ({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div className={['ds-dialog__body', className].filter(Boolean).join(' ')} {...rest}>
    {children}
  </div>
);

const Footer = ({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div className={['ds-dialog__footer', className].filter(Boolean).join(' ')} {...rest}>
    {children}
  </div>
);

const Close = ({ children }: { children: ReactElement }) => {
  const ctx = useDialogContext();
  if (!isValidElement(children)) return null;
  return cloneElement(children as ReactElement<Record<string, unknown>>, {
    onClick: (e: React.MouseEvent) => {
      (children.props as { onClick?: (e: React.MouseEvent) => void }).onClick?.(e);
      ctx.setOpen(false);
    },
  });
};

(Dialog as unknown as Record<string, unknown>).Trigger = Trigger;
(Dialog as unknown as Record<string, unknown>).Content = Content;
(Dialog as unknown as Record<string, unknown>).Header = Header;
(Dialog as unknown as Record<string, unknown>).Title = Title;
(Dialog as unknown as Record<string, unknown>).Description = Description;
(Dialog as unknown as Record<string, unknown>).Body = Body;
(Dialog as unknown as Record<string, unknown>).Footer = Footer;
(Dialog as unknown as Record<string, unknown>).Close = Close;

export type DialogCompound = typeof Dialog & {
  Trigger: typeof Trigger;
  Content: typeof Content;
  Header: typeof Header;
  Title: typeof Title;
  Description: typeof Description;
  Body: typeof Body;
  Footer: typeof Footer;
  Close: typeof Close;
};

const DialogCompound = Dialog as DialogCompound;
export { DialogCompound };
