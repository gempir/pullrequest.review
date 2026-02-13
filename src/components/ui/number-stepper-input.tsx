import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface NumberStepperInputProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
}

function clampValue(value: number, min?: number, max?: number) {
  if (min !== undefined && value < min) return min;
  if (max !== undefined && value > max) return max;
  return value;
}

function stepPrecision(step?: number) {
  if (!step || Number.isInteger(step)) return 0;
  const value = String(step);
  const dotIndex = value.indexOf(".");
  if (dotIndex < 0) return 0;
  return value.length - dotIndex - 1;
}

export function NumberStepperInput({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  className,
  disabled = false,
}: NumberStepperInputProps) {
  const precision = stepPrecision(step);
  const applyValue = (next: number) => {
    const fixed = Number(next.toFixed(precision));
    onValueChange(clampValue(fixed, min, max));
  };

  return (
    <div className={cn("relative", disabled ? "opacity-60" : "", className)}>
      <Input
        type="number"
        value={value}
        disabled={disabled}
        onChange={(event) => {
          if (disabled) return;
          const parsed = Number(event.target.value);
          if (!Number.isFinite(parsed)) return;
          applyValue(parsed);
        }}
        min={min}
        max={max}
        step={step}
        className="h-9 w-full pr-9 text-[12px]"
      />
      <div className="absolute inset-y-0 right-0 flex w-9 flex-col border-l border-border divide-y divide-border">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-1/2 w-full rounded-none p-0"
          disabled={disabled}
          onClick={() => applyValue(value + step)}
          aria-label="Increase value"
        >
          <ChevronUp className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-1/2 w-full rounded-none p-0"
          disabled={disabled}
          onClick={() => applyValue(value - step)}
          aria-label="Decrease value"
        >
          <ChevronDown className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
