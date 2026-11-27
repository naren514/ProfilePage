import { redirect } from "next/navigation";

// The Feed is now Discover, the first tab of Reading
export default function Page() {
  redirect("/admin/reading");
}
