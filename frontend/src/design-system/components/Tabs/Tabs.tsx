import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react';
import './Tabs.css';

export type TabsVariant = 'line' | 'pill';
export type TabsOrientation = 'horizontal' | 'vertical';

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
  baseId: string;
  variant: TabsVariant;
  orientation: TabsOrientation;
  registerTab: (value: string, el: HTMLButtonElement | null) => void;
  /** 矢印キーによる移動 */
  focusByOffset: (currentValue: string, offset: number) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);
const useTabsContext = () => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs.* must be used inside <Tabs>');
  return ctx;
};

export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  variant?: TabsVariant;
  orientation?: TabsOrientation;
  children: ReactNode;
}

export const Tabs = ({
  value: valueProp,
  defaultValue = '',
  onChange,
  variant = 'line',
  orientation = 'horizontal',
  className,
  children,
  ...rest
}: TabsProps) => {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const value = valueProp ?? uncontrolled;
  const baseId = useId();
  const tabsRef = useRef<Map<string, HTMLButtonElement>>(new Map());

  const setValue = useCallback(
    (next: string) => {
      if (valueProp === undefined) setUncontrolled(next);
      onChange?.(next);
    },
    [valueProp, onChange],
  );

  const registerTab = useCallback((val: string, el: HTMLButtonElement | null) => {
    if (el) tabsRef.current.set(val, el);
    else tabsRef.current.delete(val);
  }, []);

  const focusByOffset = useCallback((currentValue: string, offset: number) => {
    const values = Array.from(tabsRef.current.keys());
    const filtered = values.filter((v) => {
      const el = tabsRef.current.get(v);
      return el && !el.disabled;
    });
    if (filtered.length === 0) return;
    let idx = filtered.indexOf(currentValue);
    if (idx === -1) idx = 0;
    const next = (idx + offset + filtered.length) % filtered.length;
    const nextValue = filtered[next];
    if (!nextValue) return;
    const el = tabsRef.current.get(nextValue);
    el?.focus();
    setValue(nextValue);
  }, [setValue]);

  const ctx: TabsContextValue = useMemo(
    () => ({ value, setValue, baseId, variant, orientation, registerTab, focusByOffset }),
    [value, setValue, baseId, variant, orientation, registerTab, focusByOffset],
  );

  const classes = [
    'ds-tabs',
    `ds-tabs--${variant}`,
    `ds-tabs--${orientation}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <TabsContext.Provider value={ctx}>
      <div className={classes} {...rest}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

// ── List ──
export interface TabsListProps extends HTMLAttributes<HTMLDivElement> {
  /** アクセシビリティラベル (tablist の aria-label) */
  ariaLabel?: string;
}
const List = ({ className, ariaLabel, children, ...rest }: TabsListProps) => {
  const ctx = useTabsContext();
  return (
    <div
      role="tablist"
      aria-orientation={ctx.orientation}
      aria-label={ariaLabel}
      className={['ds-tabs__list', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
};

// ── Tab ──
export interface TabProps extends HTMLAttributes<HTMLButtonElement> {
  value: string;
  disabled?: boolean;
  children: ReactNode;
}
const Tab = ({ value, disabled, className, onClick, onKeyDown, children, ...rest }: TabProps) => {
  const ctx = useTabsContext();
  const isActive = ctx.value === value;
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    ctx.registerTab(value, ref.current);
    return () => ctx.registerTab(value, null);
  }, [ctx, value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    const horizontal = ctx.orientation === 'horizontal';
    const next = horizontal ? 'ArrowRight' : 'ArrowDown';
    const prev = horizontal ? 'ArrowLeft' : 'ArrowUp';
    if (e.key === next) {
      e.preventDefault();
      ctx.focusByOffset(value, 1);
    } else if (e.key === prev) {
      e.preventDefault();
      ctx.focusByOffset(value, -1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      ctx.focusByOffset(value, -9999);
    } else if (e.key === 'End') {
      e.preventDefault();
      ctx.focusByOffset(value, 9999);
    }
  };

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      id={`${ctx.baseId}-tab-${value}`}
      aria-selected={isActive}
      aria-controls={`${ctx.baseId}-panel-${value}`}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      className={[
        'ds-tabs__tab',
        isActive && 'ds-tabs__tab--active',
        disabled && 'ds-tabs__tab--disabled',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented && !disabled) ctx.setValue(value);
      }}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {children}
    </button>
  );
};

// ── Panel ──
export interface TabPanelProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  /** 非アクティブパネルを DOM に残すか（フォーム状態保持等で true）。デフォルトは unmount。 */
  keepMounted?: boolean;
}
const Panel = ({ value, keepMounted = false, className, children, ...rest }: TabPanelProps) => {
  const ctx = useTabsContext();
  const isActive = ctx.value === value;
  if (!isActive && !keepMounted) return null;
  return (
    <div
      role="tabpanel"
      id={`${ctx.baseId}-panel-${value}`}
      aria-labelledby={`${ctx.baseId}-tab-${value}`}
      hidden={!isActive}
      tabIndex={0}
      className={['ds-tabs__panel', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
};

(Tabs as unknown as Record<string, unknown>).List = List;
(Tabs as unknown as Record<string, unknown>).Tab = Tab;
(Tabs as unknown as Record<string, unknown>).Panel = Panel;

export type TabsCompound = typeof Tabs & {
  List: typeof List;
  Tab: typeof Tab;
  Panel: typeof Panel;
};
const TabsCompound = Tabs as TabsCompound;
export { TabsCompound };
