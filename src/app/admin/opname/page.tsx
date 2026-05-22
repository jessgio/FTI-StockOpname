import { AdminOpnameClient } from "@/components/AdminOpnameClient";
import { fetchBootstrap } from "@/lib/sheets";

export default async function AdminOpnamePage() {
  const bootstrap = await fetchBootstrap();
  return <AdminOpnameClient bootstrap={bootstrap} />;
}
