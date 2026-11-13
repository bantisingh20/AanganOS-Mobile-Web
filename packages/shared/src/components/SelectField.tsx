import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@shared/components/ui/select';
import { cn } from '@shared/lib/utils';
import { Field } from './Field';

export interface SelectOption {
  value: string;
  label: string;
}

export function SelectField({
  label,
  value,
  options,
  placeholder,
  onChange,
  disabled,
  error,
  required,
  className,
}: {
  label?: string;
  value: string | null;
  options: SelectOption[];
  placeholder?: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  error?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <Field {...(label !== undefined ? { label } : {})} {...(error ? { error } : {})} {...(required ? { required: true } : {})}>
      <Select value={value ?? undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className={cn('h-12 text-sm', error ? 'border-destructive' : '', className)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-sm">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
