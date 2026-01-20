import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { getServerUser } from "@/lib/firebase/server-auth";

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
    <div className="flex min-h-screen">
      <AdminSidebar user={{ name: user.name, email: user.email }} />
      <main className="flex-1 p-8 ml-64">{children}</main>
    </div>
  );
}
