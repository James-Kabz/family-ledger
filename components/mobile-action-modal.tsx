"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Props = {
  triggerLabel: string;
  children: ReactNode;
  title?: string;
  description?: string;
  triggerVariant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  contentClassName?: string;
};

export function MobileActionModal({
  triggerLabel,
  children,
  title,
  description,
  triggerVariant = "outline",
  contentClassName,
}: Props) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant={triggerVariant} className="h-11 w-full justify-center">
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className={contentClassName}>
        {title ? (
          <div className="sr-only">
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </div>
        ) : null}
        <div className="mb-3 flex justify-end sm:hidden">
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="sm">
              Close
            </Button>
          </DialogClose>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}
