import { ArrowRight, Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from '@shared/components/ui/button';
import { cn } from '@shared/lib/utils';

export function PrimaryButton({
  label,
  loading,
  arrow = true,
  className,
  ...props
}: { label: string; loading?: boolean; arrow?: boolean } & Omit<ButtonProps, 'children'>) {
  return (
    <Button
      disabled={loading || props.disabled}
      className={cn('relative h-[52px] w-full rounded-xl text-base font-bold', className)}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <>
          {label}
          {arrow ? (
            <span className="absolute right-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
              <ArrowRight className="h-[18px] w-[18px]" />
            </span>
          ) : null}
        </>
      )}
    </Button>
  );
}
