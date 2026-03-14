"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/(auth)/actions";

function LogoutSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button size="sm" type="submit" variant="secondary" disabled={pending}>
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <LogoutSubmitButton />
    </form>
  );
}
