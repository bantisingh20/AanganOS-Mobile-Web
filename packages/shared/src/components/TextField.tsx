import * as React from 'react';
import { type LucideIcon } from 'lucide-react';
import { Input } from '@shared/components/ui/input';
import { cn } from '@shared/lib/utils';
import { Field } from './Field';

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: LucideIcon;
  onEnter?: () => void;
  requiredMark?: boolean;
}

export function TextField({ label, error, icon: Icon, onEnter, requiredMark, className, ...props }: TextFieldProps) {
  return (
    <Field {...(label !== undefined ? { label } : {})} {...(error ? { error } : {})} {...(requiredMark ? { required: true } : {})}>
      <div className="relative">
        {Icon ? <Icon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /> : null}
        <Input
          className={cn('h-12', Icon ? 'pl-10' : '', error ? 'border-destructive' : '', className)}
          onKeyDown={(e) => { if (e.key === 'Enter') onEnter?.(); }}
          {...props}
        />
      </div>
    </Field>
  );
}
