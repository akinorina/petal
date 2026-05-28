import {
  cloneElement,
  createContext,
  forwardRef,
  isValidElement,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { HTMLAttributes, ReactElement, ReactNode, Ref } from 'react';
import {
  arrow,
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useFloatingNodeId,
  useInteractions,
  useMergeRefs,
  useRole,
} from '@floating-ui/react';
import type { Middleware, Placement } from '@floating-ui/react';
import './Popover.css';

export type PopoverPlacement = Placement;

interface PopoverContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  refs: ReturnType<typeof useFloating>['refs'];
  floatingStyles: ReturnType<typeof useFloating>['floatingStyles'];
  getReferenceProps: ReturnType<typeof useInteractions>['getReferenceProps'];
  getFloatingProps: ReturnType<typeof useInteractions>['getFloatingProps'];
  context: ReturnType<typeof useFloating>['context'];
  arrowRef: React.MutableRefObject<SVGSVGElement | null>;
  middlewareData: ReturnType<typeof useFloating>['middlewareData'];
  placement: Placement;
  hasArrow: boolean;
  nodeId: string | undefined;
}

const PopoverContext = createContext<PopoverContextValue | null>(null);

const usePopoverContext = () => {
  const ctx = useContext(PopoverContext);
  if (!ctx) throw new Error('Popover.* must be used inside <Popover>');
  return ctx;
};

export interface PopoverProps {
  /** trigger と content の 2 つの Popover.* を内包する */
  children: ReactNode;
  /** uncontrolled の初期値 */
  defaultOpen?: boolean;
  /** controlled */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 配置 */
  placement?: PopoverPlacement;
  /** trigger と content の間隔 (px) */
  offset?: number;
  /** 矢印を表示するか */
  hasArrow?: boolean;
  /** 外側クリック / Esc で閉じるかどうか */
  dismissable?: boolean;
}

export const Popover = ({
  children,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  placement = 'bottom',
  offset: offsetVal = 8,
  hasArrow = false,
  dismissable = true,
}: PopoverProps) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const arrowRef = useMemo(() => ({ current: null as SVGSVGElement | null }), []);
  const nodeId = useFloatingNodeId();

  const data = useFloating({
    nodeId,
    open,
    onOpenChange: setOpen,
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(offsetVal),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      hasArrow ? arrow({ element: arrowRef }) : null,
    ].filter(Boolean) as Middleware[],
  });

  const click = useClick(data.context);
  const dismiss = useDismiss(data.context, { enabled: dismissable });
  const role = useRole(data.context, { role: 'dialog' });
  const interactions = useInteractions([click, dismiss, role]);

  const ctxValue: PopoverContextValue = {
    open,
    setOpen,
    refs: data.refs,
    floatingStyles: data.floatingStyles,
    getReferenceProps: interactions.getReferenceProps,
    getFloatingProps: interactions.getFloatingProps,
    context: data.context,
    arrowRef,
    middlewareData: data.middlewareData,
    placement: data.placement,
    hasArrow,
    nodeId,
  };

  return <PopoverContext.Provider value={ctxValue}>{children}</PopoverContext.Provider>;
};

// ── Trigger ──
export interface PopoverTriggerProps {
  /** 子は単一要素。クリック / aria-expanded が転送される */
  children: ReactElement;
}

const Trigger = ({ children }: PopoverTriggerProps) => {
  const ctx = usePopoverContext();
  const child = isValidElement(children) ? children : null;
  const childRef = (child as unknown as { ref?: Ref<HTMLElement> } | null)?.ref;
  const mergedRef = useMergeRefs([ctx.refs.setReference, childRef ?? null]);
  if (!child) return null;

  return cloneElement(child as ReactElement<Record<string, unknown>>, {
    ref: mergedRef,
    ...ctx.getReferenceProps(child.props as Record<string, unknown>),
    'data-popover-open': ctx.open ? 'true' : undefined,
  });
};

// ── Content ──
export interface PopoverContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Portal を無効化する (デフォルトは body にレンダー) */
  disablePortal?: boolean;
  /** focus trap を有効化 (interactive な内容のとき) */
  manageFocus?: boolean;
}

const Content = forwardRef<HTMLDivElement, PopoverContentProps>(function PopoverContent(
  { children, className, style, disablePortal = false, manageFocus = true, ...rest },
  ref,
) {
  const ctx = usePopoverContext();
  const mergedRef = useMergeRefs([ctx.refs.setFloating, ref]);
  if (!ctx.open) return null;

  const classes = ['ds-popover', className].filter(Boolean).join(' ');

  const inner = (
    <FloatingFocusManager context={ctx.context} modal={false} disabled={!manageFocus}>
      <div
        ref={mergedRef}
        className={classes}
        style={{ ...ctx.floatingStyles, ...style }}
        {...ctx.getFloatingProps(rest)}
      >
        {children}
        {ctx.hasArrow && <PopoverArrow />}
      </div>
    </FloatingFocusManager>
  );

  return disablePortal ? inner : <FloatingPortal>{inner}</FloatingPortal>;
});

// ── Arrow ──
const ARROW_SIZE = 8;
const PopoverArrow = () => {
  const ctx = usePopoverContext();
  const { arrow: arrowData } = ctx.middlewareData;
  const side = ctx.placement.split('-')[0] as 'top' | 'right' | 'bottom' | 'left';
  const oppositeSide = { top: 'bottom', right: 'left', bottom: 'top', left: 'right' }[side];

  return (
    <svg
      ref={(el) => {
        // eslint-disable-next-line react-hooks/immutability
        ctx.arrowRef.current = el;
      }}
      className="ds-popover__arrow"
      width={ARROW_SIZE * 2}
      height={ARROW_SIZE * 2}
      viewBox="0 0 16 16"
      style={{
        position: 'absolute',
        left: arrowData?.x != null ? `${arrowData.x}px` : '',
        top: arrowData?.y != null ? `${arrowData.y}px` : '',
        [oppositeSide]: `-${ARROW_SIZE}px`,
        transform: { top: '', bottom: 'rotate(180deg)', left: 'rotate(-90deg)', right: 'rotate(90deg)' }[side],
      }}
    >
      <path d="M0 0 L8 8 L16 0 Z" />
    </svg>
  );
};

// ── Close helper ──
const Close = ({ children }: { children: ReactElement }) => {
  const ctx = usePopoverContext();
  if (!isValidElement(children)) return null;
  return cloneElement(children as ReactElement<Record<string, unknown>>, {
    onClick: (e: React.MouseEvent) => {
      (children.props as { onClick?: (e: React.MouseEvent) => void }).onClick?.(e);
      ctx.setOpen(false);
    },
  });
};

(Popover as unknown as { Trigger: typeof Trigger }).Trigger = Trigger;
(Popover as unknown as { Content: typeof Content }).Content = Content;
(Popover as unknown as { Close: typeof Close }).Close = Close;

export type PopoverCompound = typeof Popover & {
  Trigger: typeof Trigger;
  Content: typeof Content;
  Close: typeof Close;
};
const PopoverCompound = Popover as PopoverCompound;
export { PopoverCompound };
