import * as React from 'react';
import { type LucideIcon } from 'lucide-react';
import { Input } from '@shared/components/ui/input';
import { cn } from '@shared/lib/utils';
import { Field } from './Field';

export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  icon?: LucideIcon;
  onEnter?: () => void;
  requiredMark?: boolean;
  required?: boolean;
  size?: 'sm' | 'lg';
}

export function TextField({
  label,
  error,
  icon: Icon,
  onEnter,
  requiredMark,
  required,
  className,
  size = 'lg',
  ...props
}: TextFieldProps) {
  const h = size === 'sm' ? 'h-10 text-sm' : 'h-12';
  return (
    <Field {...(label !== undefined ? { label } : {})} {...(error ? { error } : {})} {...(requiredMark ? { required: true } : {})} {...(required ? { required: true } : {})}>
      <div className="relative">
        {Icon ? <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /> : null}
        <Input
          className={cn(h, Icon ? 'pl-9' : '', error ? 'border-destructive' : '', className)}
          onKeyDown={(e) => { if (e.key === 'Enter') onEnter?.(); }}
          {...props}
        />
      </div>
    </Field>
  );
}
