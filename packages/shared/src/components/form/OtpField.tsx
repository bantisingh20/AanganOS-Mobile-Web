import { InputOTP, InputOTPGroup, InputOTPSlot } from '@shared/components/ui/input-otp';
import { cn } from '@shared/lib/utils';

export function OtpField({
  value,
  onChange,
  error,
  disabled,
  onComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
  disabled?: boolean;
  onComplete?: () => void;
}) {
  return (
    <InputOTP
      maxLength={6}
      value={value}
      onChange={onChange}
      {...(onComplete ? { onComplete } : {})}
      disabled={disabled}
      containerClassName="justify-between w-full"
    >
      <InputOTPGroup className="flex w-full justify-between gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <InputOTPSlot
            key={i}
            index={i}
            className={cn(
              'h-14 w-full rounded-xl border-[1.5px] text-xl font-extrabold first:rounded-l-xl last:rounded-r-xl',
              error ? 'border-destructive' : '',
            )}
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
