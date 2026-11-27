import { redirect } from "next/navigation";

// Moved to the AI page
export default function Page() {
  redirect("/admin/ai/memory");
}
