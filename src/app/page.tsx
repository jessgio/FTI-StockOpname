import Link from "next/link";
import { AppShell, Card, NavLink } from "@/components/ui";

export default function HomePage() {
  return (
    <AppShell
      title="Inventory counts"
      subtitle="Lightweight stock counts backed by Google Sheets"
    >
      <Card className="space-y-4">
        <p className="text-stone-700">
          Each device starts a session, scans a counter QR, then location → SKU →
          quantity. Managers track progress on the dashboard.
        </p>
        <div className="grid gap-3">
          <NavLink href="/count">Start counting</NavLink>
          <NavLink href="/dashboard">Open dashboard</NavLink>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Counting order
        </h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-stone-700">
          <li>Select the stock count session</li>
          <li>Enter the session PIN (if required)</li>
          <li>Scan your counter (name) QR</li>
          <li>Lock the location (stays fixed at the top)</li>
          <li>Scan SKU and quantity on the same screen</li>
          <li>Review, edit, or delete your counts in history below</li>
          <li>End session when finished on this device</li>
        </ol>
      </Card>

      <p className="text-center text-xs text-stone-500">
        <Link href="/dashboard" className="underline">
          Dashboard
        </Link>{" "}
        auto-refreshes from the Counts tab.
      </p>
    </AppShell>
  );
}
