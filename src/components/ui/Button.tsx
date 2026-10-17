import type { ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export function Button({ className, variant = 'secondary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  return <button {...props} className={clsx('ui-button', `ui-button-${variant}`, className)} />;
}
