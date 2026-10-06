import React from 'react';

export function FormField({ label, counter, multiline, invalid, className = '', ...rest }) {
  const over = counter ? counter.value > counter.max : false;
  return (
    <label className={`block mb-3 text-sm text-slate-500 ${className}`}>
      {label}
      {multiline ? (
        <textarea
          {...rest}
          className={`block w-full mt-1 px-2.5 py-2 bg-white border rounded-lg text-slate-900 transition-colors focus:outline focus:outline-2 focus:outline-brand-100 ${
            invalid ? 'border-red-600 focus:border-red-600' : 'border-slate-200 focus:border-brand-600'
          }`}
        />
      ) : (
        <input
          {...rest}
          className={`block w-full mt-1 px-2.5 py-2 bg-white border rounded-lg text-slate-900 transition-colors focus:outline focus:outline-2 focus:outline-brand-100 ${
            invalid ? 'border-red-600 focus:border-red-600' : 'border-slate-200 focus:border-brand-600'
          }`}
        />
      )}
      {counter && (
        <span className={`text-[11px] ml-1.5 ${over ? 'text-red-600 font-bold' : 'text-slate-500'}`}>
          {counter.value}/{counter.max}
        </span>
      )}
    </label>
  );
}
