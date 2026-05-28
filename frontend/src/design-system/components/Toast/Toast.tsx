import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import './Toast.css';

export type ToastVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type ToastPosition =
  | 'top-right'
  | 'top-center'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-center'
  | 'bottom-left';

export interface ToastOptions {
  id?: string;
  title?: ReactNode;
  description?: ReactNode;
  variant?: ToastVariant;
  /** ms。Infinity / 0 で自動消失しない */
  duration?: number;
  action?: ReactNode;
}

interface ToastItem extends Required<Pick<ToastOptions, 'id' | 'variant' | 'duration'>> {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

interface ToastContextValue {
  show: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
};

export interface ToastProviderProps {
  children: ReactNode;
  position?: ToastPosition;
  /** 同時表示数の上限。超過したら古いものから自動削除 */
  maxVisible?: number;
}

let _uid = 0;
const genId = () => `t${++_uid}_${Date.now()}`;

export const ToastProvider = ({
  children,
  position = 'top-right',
  maxVisible = 5,
}: ToastProviderProps) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
    timers.current.forEach((t) => clearTimeout(t));
    timers.current.clear();
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      const id = options.id ?? genId();
      const item: ToastItem = {
        id,
        variant: options.variant ?? 'neutral',
        duration: options.duration ?? 4000,
        title: options.title,
        description: options.description,
        action: options.action,
      };
      setToasts((prev) => {
        const next = [...prev, item];
        // maxVisible 超過は古いものから捨てる
        return next.length > maxVisible ? next.slice(next.length - maxVisible) : next;
      });
      if (item.duration > 0 && item.duration !== Infinity) {
        const timer = setTimeout(() => dismiss(id), item.duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss, maxVisible],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const value = useMemo(() => ({ show, dismiss, dismissAll }), [show, dismiss, dismissAll]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`ds-toast-viewport ds-toast-viewport--${position}`}
            // SR: 緊急 (danger) は assertive、それ以外は polite。
            // 個別 Toast の aria-live は内容に応じて上書き。
            aria-live="polite"
            aria-relevant="additions"
          >
            {toasts.map((t) => (
              <ToastView key={t.id} toast={t} onClose={() => dismiss(t.id)} />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
};

const ToastView = ({ toast, onClose }: { toast: ToastItem; onClose: () => void }) => {
  const isDanger = toast.variant === 'danger';
  return (
    <div
      className={`ds-toast ds-toast--${toast.variant}`}
      role={isDanger ? 'alert' : 'status'}
      aria-live={isDanger ? 'assertive' : 'polite'}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="ds-toast__content">
        {toast.title && <div className="ds-toast__title">{toast.title}</div>}
        {toast.description && <div className="ds-toast__description">{toast.description}</div>}
      </div>
      {toast.action && <div className="ds-toast__action">{toast.action}</div>}
      <button
        type="button"
        className="ds-toast__close"
        aria-label="閉じる"
        onClick={onClose}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
};
