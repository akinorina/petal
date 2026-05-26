import { cloneElement, isValidElement, useMemo, useState } from 'react';
import type { ReactElement, ReactNode, Ref } from 'react';
import {
  arrow,
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useMergeRefs,
  useRole,
  useTransitionStyles,
} from '@floating-ui/react';
import type { Middleware, Placement } from '@floating-ui/react';
import './Tooltip.css';

export type TooltipPlacement = Placement;

export interface TooltipProps {
  /** ツールチップに表示する短い文言 */
  content: ReactNode;
  /** trigger となる単一要素 */
  children: ReactElement;
  placement?: TooltipPlacement;
  /** hover/focus してから開くまでの遅延 (ms) */
  openDelay?: number;
  /** 閉じるまでの遅延 (ms) */
  closeDelay?: number;
  /** 矢印を表示するか */
  hasArrow?: boolean;
  /** trigger との間隔 (px) */
  offset?: number;
  /** 無効化（disabled 要素のときに使う） */
  disabled?: boolean;
}

export const Tooltip = ({
  content,
  children,
  placement = 'top',
  openDelay = 200,
  closeDelay = 0,
  hasArrow = true,
  offset: offsetVal = 6,
  disabled = false,
}: TooltipProps) => {
  const [open, setOpen] = useState(false);
  const arrowRef = useMemo(() => ({ current: null as SVGSVGElement | null }), []);

  const data = useFloating({
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

  const hover = useHover(data.context, {
    enabled: !disabled,
    delay: { open: openDelay, close: closeDelay },
    move: false,
  });
  const focus = useFocus(data.context, { enabled: !disabled });
  const dismiss = useDismiss(data.context);
  const role = useRole(data.context, { role: 'tooltip' });
  const interactions = useInteractions([hover, focus, dismiss, role]);

  const { isMounted, styles: transitionStyles } = useTransitionStyles(data.context, {
    duration: { open: 120, close: 80 },
    initial: { opacity: 0, transform: 'translateY(-2px)' },
  });

  const child = isValidElement(children) ? children : null;
  if (!child) return children as unknown as ReactElement;

  const childRef = (child as unknown as { ref?: Ref<HTMLElement> }).ref;
  const mergedRef = useMergeRefs([data.refs.setReference, childRef ?? null]);

  const triggerEl = cloneElement(child as ReactElement<Record<string, unknown>>, {
    ref: mergedRef,
    ...interactions.getReferenceProps(child.props as Record<string, unknown>),
  });

  const { arrow: arrowData } = data.middlewareData;
  const side = data.placement.split('-')[0] as 'top' | 'right' | 'bottom' | 'left';
  const oppositeSide = { top: 'bottom', right: 'left', bottom: 'top', left: 'right' }[side];

  return (
    <>
      {triggerEl}
      {!disabled && isMounted && (
        <FloatingPortal>
          <div
            ref={data.refs.setFloating}
            className="ds-tooltip"
            style={{ ...data.floatingStyles, ...transitionStyles }}
            {...interactions.getFloatingProps()}
          >
            {content}
            {hasArrow && (
              <svg
                ref={(el) => {
                  arrowRef.current = el;
                }}
                className="ds-tooltip__arrow"
                width="12"
                height="12"
                viewBox="0 0 12 12"
                style={{
                  position: 'absolute',
                  left: arrowData?.x != null ? `${arrowData.x}px` : '',
                  top: arrowData?.y != null ? `${arrowData.y}px` : '',
                  [oppositeSide]: '-6px',
                  transform: { top: '', bottom: 'rotate(180deg)', left: 'rotate(-90deg)', right: 'rotate(90deg)' }[side],
                }}
              >
                <path d="M0 0 L6 6 L12 0 Z" />
              </svg>
            )}
          </div>
        </FloatingPortal>
      )}
    </>
  );
};
