"use client";

import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";

type Props = ButtonProps & {
  pendingLabel?: string;
};

export function SubmitButton({ children, pendingLabel = "Saving...", disabled, ...props }: Props) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={disabled || pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
