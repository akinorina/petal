import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  size,
  useClick,
  useDismiss,
  useFloating,
  useFloatingNodeId,
  useInteractions,
  useListNavigation,
  useRole,
  useTypeahead,
} from '@floating-ui/react';
import './Select.css';

export type SelectSize = 'sm' | 'md' | 'lg';

export interface SelectOption<V extends string = string> {
  value: V;
  label: string;
  description?: string;
  leading?: ReactNode;
  disabled?: boolean;
}

export interface SelectProps<V extends string = string> {
  options: SelectOption<V>[];
  value?: V | null;
  defaultValue?: V | null;
  onChange?: (value: V) => void;
  placeholder?: string;
  size?: SelectSize;
  hasError?: boolean;
  disabled?: boolean;
  isFullWidth?: boolean;
  /** trigger に付与する id (FormField から自動配線される) */
  id?: string;
  name?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
  required?: boolean;
  className?: string;
}

const ChevronIcon = () => (
  <svg className="ds-select__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CheckIcon = () => (
  <svg className="ds-select__check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Select = forwardRef<HTMLButtonElement, SelectProps<string>>(function Select<
  V extends string,
>(
  {
    options,
    value: valueProp,
    defaultValue = null,
    onChange,
    placeholder = '選択してください',
    size: sizeProp = 'md',
    hasError = false,
    disabled = false,
    isFullWidth = true,
    id,
    name,
    required,
    className,
    ...aria
  }: SelectProps<V>,
  ref: React.Ref<HTMLButtonElement>,
) {
  const [open, setOpen] = useState(false);
  const [uncontrolled, setUncontrolled] = useState<V | null>(defaultValue);
  const value = valueProp !== undefined ? valueProp : uncontrolled;

  const selectedIndex = useMemo(
    () => (value == null ? -1 : options.findIndex((o) => o.value === value)),
    [options, value],
  );
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const listRef = useRef<Array<HTMLElement | null>>([]);
  const labelsRef = useRef<Array<string | null>>(options.map((o) => o.label));
  useEffect(() => {
    labelsRef.current = options.map((o) => o.label);
  }, [options]);

  const nodeId = useFloatingNodeId();
  const data = useFloating({
    nodeId,
    open,
    onOpenChange: setOpen,
    placement: 'bottom-start',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(4),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        apply({ rects, availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            minWidth: `${rects.reference.width}px`,
            maxHeight: `${Math.min(availableHeight - 8, 320)}px`,
          });
        },
        padding: 8,
      }),
    ],
  });

  const listNav = useListNavigation(data.context, {
    listRef,
    activeIndex,
    selectedIndex: selectedIndex >= 0 ? selectedIndex : undefined,
    onNavigate: setActiveIndex,
    loop: true,
  });
  const typeahead = useTypeahead(data.context, {
    listRef: labelsRef,
    activeIndex,
    selectedIndex: selectedIndex >= 0 ? selectedIndex : undefined,
    onMatch: open ? setActiveIndex : (idx) => commit(idx),
  });
  const click = useClick(data.context, { event: 'mousedown' });
  const dismiss = useDismiss(data.context);
  const role = useRole(data.context, { role: 'listbox' });
  const interactions = useInteractions([
    click,
    listNav,
    typeahead,
    dismiss,
    role,
  ]);

  const commit = useCallback(
    (idx: number | null) => {
      if (idx == null || idx < 0 || idx >= options.length) return;
      const opt = options[idx];
      if (!opt || opt.disabled) return;
      if (valueProp === undefined) setUncontrolled(opt.value);
      onChange?.(opt.value);
    },
    [options, onChange, valueProp],
  );

  const handleTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setOpen(true);
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  };

  const triggerClasses = [
    'ds-select__trigger',
    `ds-select__trigger--${sizeProp}`,
    isFullWidth && 'ds-select__trigger--full-width',
    hasError && 'ds-select__trigger--error',
    disabled && 'ds-select__trigger--disabled',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  return (
    <>
      {/* Native hidden input for form submission */}
      {name && <input type="hidden" name={name} value={value ?? ''} required={required} />}
      {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props */}
      <button
        type="button"
        ref={(node) => {
          data.refs.setReference(node);
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
        }}
        id={id}
        className={triggerClasses}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={aria['aria-invalid'] ?? (hasError || undefined)}
        aria-required={aria['aria-required']}
        aria-label={aria['aria-label']}
        aria-labelledby={aria['aria-labelledby']}
        aria-describedby={aria['aria-describedby']}
        onKeyDown={handleTriggerKeyDown}
        {...interactions.getReferenceProps()}
      >
        <span
          className={
            selectedOption ? 'ds-select__value' : 'ds-select__value ds-select__value--placeholder'
          }
        >
          {selectedOption ? (
            <>
              {selectedOption.leading && (
                <span className="ds-select__value-leading">{selectedOption.leading}</span>
              )}
              {selectedOption.label}
            </>
          ) : (
            placeholder
          )}
        </span>
        <ChevronIcon />
      </button>

      {open && (
        <FloatingPortal>
          {/* eslint-disable-next-line react-hooks/refs */}
          <FloatingFocusManager context={data.context} modal={false}>
            <ul
              // eslint-disable-next-line react-hooks/refs
              ref={data.refs.setFloating}
              className="ds-select__menu"
              // eslint-disable-next-line react-hooks/refs
              style={data.floatingStyles}
              {...interactions.getFloatingProps()}
            >
              {options.map((opt, i) => {
                const isSelected = i === selectedIndex;
                const isActive = i === activeIndex;
                return (
                  <li
                    key={opt.value}
                    ref={(node) => {
                      listRef.current[i] = node;
                    }}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled || undefined}
                    tabIndex={isActive ? 0 : -1}
                    className={[
                      'ds-select__option',
                      isSelected && 'ds-select__option--selected',
                      isActive && !opt.disabled && 'ds-select__option--active',
                      opt.disabled && 'ds-select__option--disabled',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    {...interactions.getItemProps({
                      onClick: () => {
                        if (opt.disabled) return;
                        commit(i);
                        setOpen(false);
                      },
                      onKeyDown(e) {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (opt.disabled) return;
                          commit(i);
                          setOpen(false);
                        }
                      },
                    })}
                  >
                    {opt.leading && <span className="ds-select__option-leading">{opt.leading}</span>}
                    <span className="ds-select__option-content">
                      <span className="ds-select__option-label">{opt.label}</span>
                      {opt.description && (
                        <span className="ds-select__option-description">{opt.description}</span>
                      )}
                    </span>
                    {isSelected && <CheckIcon />}
                  </li>
                );
              })}
            </ul>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}) as <V extends string = string>(
  props: SelectProps<V> & { ref?: React.Ref<HTMLButtonElement> },
) => React.ReactElement;
