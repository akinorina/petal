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
import './Sheet.css';

export type SheetSide = 'top' | 'right' | 'bottom' | 'left';
export type SheetSize = 'auto' | 'sm' | 'md' | 'lg' | 'full';

interface SheetContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  refs: ReturnType<typeof useFloating>['refs'];
  context: ReturnType<typeof useFloating>['context'];
  getReferenceProps: ReturnType<typeof useInteractions>['getReferenceProps'];
  getFloatingProps: ReturnType<typeof useInteractions>['getFloatingProps'];
  titleId: string;
  descriptionId: string;
  side: SheetSide;
  size: SheetSize;
}

const SheetContext = createContext<SheetContextValue | null>(null);
const useSheetContext = () => {
  const ctx = useContext(SheetContext);
  if (!ctx) throw new Error('Sheet.* must be used inside <Sheet>');
  return ctx;
};

export interface SheetProps {
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 出現方向 */
  side?: SheetSide;
  size?: SheetSize;
  closeOnOverlayClick?: boolean;
}

export const Sheet = ({
  children,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  side = 'right',
  size = 'md',
  closeOnOverlayClick = true,
}: SheetProps) => {
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
  const value: SheetContextValue = {
    open,
    setOpen,
    refs: data.refs,
    context: data.context,
    getReferenceProps: interactions.getReferenceProps,
    getFloatingProps: interactions.getFloatingProps,
    titleId: `ds-sheet-title-${baseId}`,
    descriptionId: `ds-sheet-desc-${baseId}`,
    side,
    size,
  };

  return <SheetContext.Provider value={value}>{children}</SheetContext.Provider>;
};

// ── Trigger ──
const Trigger = ({ children }: { children: ReactElement }) => {
  const ctx = useSheetContext();
  const child = isValidElement(children) ? children : null;
  if (!child) return null;
  const childRef = (child as unknown as { ref?: Ref<HTMLElement> }).ref;
  const mergedRef = useMergeRefs([ctx.refs.setReference, childRef ?? null]);
  return cloneElement(child as ReactElement<Record<string, unknown>>, {
    ref: mergedRef,
    ...ctx.getReferenceProps(child.props as Record<string, unknown>),
  });
};

// ── Content ──
export interface SheetContentProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

const SLIDE_OFFSETS: Record<SheetSide, string> = {
  top: 'translateY(-100%)',
  right: 'translateX(100%)',
  bottom: 'translateY(100%)',
  left: 'translateX(-100%)',
};

const Content = forwardRef<HTMLDivElement, SheetContentProps>(function SheetContent(
  { children, className, ...rest },
  ref,
) {
  const ctx = useSheetContext();
  const mergedRef = useMergeRefs([ctx.refs.setFloating, ref]);

  const { isMounted, styles } = useTransitionStyles(ctx.context, {
    duration: { open: 300, close: 200 },
    initial: { transform: SLIDE_OFFSETS[ctx.side] },
  });
  const { styles: overlayStyles } = useTransitionStyles(ctx.context, {
    duration: { open: 200, close: 150 },
    initial: { opacity: 0 },
  });

  if (!isMounted) return null;

  return (
    <FloatingPortal>
      <FloatingOverlay
        className="ds-sheet__overlay"
        style={overlayStyles}
        lockScroll
      >
        <FloatingFocusManager context={ctx.context}>
          <div
            ref={mergedRef}
            className={[
              'ds-sheet',
              `ds-sheet--${ctx.side}`,
              `ds-sheet--size-${ctx.size}`,
              className,
            ]
              .filter(Boolean)
              .join(' ')}
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

// ── Compound parts ──
const Header = ({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div className={['ds-sheet__header', className].filter(Boolean).join(' ')} {...rest}>
    {children}
  </div>
);
const Title = ({ className, children, ...rest }: HTMLAttributes<HTMLHeadingElement>) => {
  const ctx = useSheetContext();
  return (
    <h2 id={ctx.titleId} className={['ds-sheet__title', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </h2>
  );
};
const Description = ({ className, children, ...rest }: HTMLAttributes<HTMLParagraphElement>) => {
  const ctx = useSheetContext();
  return (
    <p id={ctx.descriptionId} className={['ds-sheet__description', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </p>
  );
};
const Body = ({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div className={['ds-sheet__body', className].filter(Boolean).join(' ')} {...rest}>
    {children}
  </div>
);
const Footer = ({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div className={['ds-sheet__footer', className].filter(Boolean).join(' ')} {...rest}>
    {children}
  </div>
);
const Close = ({ children }: { children: ReactElement }) => {
  const ctx = useSheetContext();
  if (!isValidElement(children)) return null;
  return cloneElement(children as ReactElement<Record<string, unknown>>, {
    onClick: (e: React.MouseEvent) => {
      (children.props as { onClick?: (e: React.MouseEvent) => void }).onClick?.(e);
      ctx.setOpen(false);
    },
  });
};

(Sheet as unknown as Record<string, unknown>).Trigger = Trigger;
(Sheet as unknown as Record<string, unknown>).Content = Content;
(Sheet as unknown as Record<string, unknown>).Header = Header;
(Sheet as unknown as Record<string, unknown>).Title = Title;
(Sheet as unknown as Record<string, unknown>).Description = Description;
(Sheet as unknown as Record<string, unknown>).Body = Body;
(Sheet as unknown as Record<string, unknown>).Footer = Footer;
(Sheet as unknown as Record<string, unknown>).Close = Close;

export type SheetCompound = typeof Sheet & {
  Trigger: typeof Trigger;
  Content: typeof Content;
  Header: typeof Header;
  Title: typeof Title;
  Description: typeof Description;
  Body: typeof Body;
  Footer: typeof Footer;
  Close: typeof Close;
};
const SheetCompound = Sheet as SheetCompound;
export { SheetCompound };
