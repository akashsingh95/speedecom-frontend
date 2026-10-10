import React from 'react';
import { BTN, BTN_PRIMARY, BTN_GHOST, BTN_SMALL } from './classNames';

export function Button({ variant = 'default', size = 'default', loading, className = '', disabled, children, ...rest }) {
  const variantCls = variant === 'primary' ? BTN_PRIMARY : variant === 'ghost' ? BTN_GHOST : BTN;
  const cls = [variantCls, size === 'small' && BTN_SMALL, className].filter(Boolean).join(' ');
  return (
    <button className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {children}
    </button>
  );
}
