"use client";

import { logoutAction } from "@/lib/actions";
import { SubmitButton } from "@/components/submit-button";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <SubmitButton variant="outline" size="sm" pendingLabel="Signing out...">
        Logout
      </SubmitButton>
    </form>
  );
}
