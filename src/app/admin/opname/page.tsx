import { AdminOpnameClient } from "@/components/AdminOpnameClient";
import { fetchBootstrap } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminOpnamePage() {
  const bootstrap = await fetchBootstrap({ fresh: true });
  return <AdminOpnameClient bootstrap={bootstrap} />;
}
