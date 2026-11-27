import { redirect } from "next/navigation";

// The weekly list is now the "This week" tab of Reading (settings behind the gear)
export default function Page() {
  redirect("/admin/reading/week");
}
