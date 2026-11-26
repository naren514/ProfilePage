import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getServerUser } from "@/lib/auth/server-auth";
import { AuthProvider } from "@/lib/auth/auth-context";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <AuthProvider>
      <AdminShell user={{ name: user.name, email: user.email }}>{children}</AdminShell>
    </AuthProvider>
  );
}
