import { requireGuest } from "@/lib/auth/session";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await requireGuest();

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <LoginForm />
    </div>
  );
}
