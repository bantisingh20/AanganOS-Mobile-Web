import { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { Input } from '@shared/components/ui/input';
import { cn } from '@shared/lib/utils';
import { Field } from './Field';

export function PasswordField({
  label,
  value,
  onChange,
  error,
  placeholder,
  disabled,
  onEnter,
  className,
  size = 'lg',
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  onEnter?: () => void;
  className?: string;
  size?: 'sm' | 'lg';
}) {
  const [show, setShow] = useState(false);
  const h = size === 'sm' ? 'h-10 text-sm' : 'h-12';
  return (
    <Field {...(label !== undefined ? { label } : {})} {...(error ? { error } : {})}>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoCapitalize="none"
          onKeyDown={(e) => { if (e.key === 'Enter') onEnter?.(); }}
          className={cn(h, 'pl-9 pr-9', error ? 'border-destructive' : '', className)}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </Field>
  );
}
