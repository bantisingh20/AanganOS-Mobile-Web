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
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  onEnter?: () => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <Field {...(label !== undefined ? { label } : {})} {...(error ? { error } : {})}>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoCapitalize="none"
          onKeyDown={(e) => { if (e.key === 'Enter') onEnter?.(); }}
          className={cn('h-12 pl-10 pr-10', error ? 'border-destructive' : '')}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </Field>
  );
}
