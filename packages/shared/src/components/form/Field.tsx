import * as React from 'react';
import { Label } from '@shared/components/ui/label';

export function Field({
  label,
  error,
  required,
  children,
}: {
  label?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <Label className="text-sm font-semibold">
          {label}
          {required ? <span className="ml-0.5 text-destructive">*</span> : null}
        </Label>
      ) : null}
      {children}
      {error && error.trim() ? (
        <span role="alert" className="text-sm text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}
