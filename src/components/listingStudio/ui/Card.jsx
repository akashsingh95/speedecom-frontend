import React from 'react';
import { CARD } from './classNames';

export function Card({ className = '', children, ...rest }) {
  return (
    <div className={[CARD, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}
