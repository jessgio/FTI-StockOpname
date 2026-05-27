"use client";

import type { LocationTaskStatus } from "@/lib/assignments";
import type { Sku } from "@/lib/types";

function skuLabel(sku: string, skus: Sku[]): string {
  const item = skus.find(
    (s) =>
      s.sku.toLowerCase() === sku.toLowerCase() ||
      s.name.toLowerCase() === sku.toLowerCase(),
  );
  return item?.name ? `${sku} · ${item.name}` : sku;
}

export function AssignmentTaskList({
  tasks,
  skus,
  activeLocation,
  onSelectLocation,
  selectable = false,
}: {
  tasks: LocationTaskStatus[];
  skus: Sku[];
  activeLocation?: string | null;
  onSelectLocation?: (location: string) => void;
  selectable?: boolean;
}) {
  if (tasks.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-stone-700">Your locations</p>
      <ul className="space-y-2">
        {tasks.map((task) => {
          const isActive =
            activeLocation &&
            task.location.trim().toLowerCase() ===
              activeLocation.trim().toLowerCase();
          const baseClass = task.complete
            ? "border-green-300 bg-green-50 text-green-950"
            : "border-stone-200 bg-stone-50/90 text-stone-600";

          const inner = (
            <>
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`font-medium ${task.complete ? "text-green-900" : "text-stone-700"}`}
                >
                  {task.location}
                </span>
                {task.complete ? (
                  <span className="text-xs font-semibold uppercase tracking-wide text-green-700">
                    Done
                  </span>
                ) : null}
              </div>
              {task.skus.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {task.skus.map((row) => (
                    <li
                      key={`${task.location}-${row.sku}`}
                      className={
                        row.done ? "text-green-800" : "text-stone-500"
                      }
                    >
                      {row.done ? "✓ " : "○ "}
                      {skuLabel(row.sku, skus)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-stone-500">
                  {task.complete
                    ? "Location visited"
                    : "Count any SKUs at this location"}
                </p>
              )}
            </>
          );

          if (selectable && onSelectLocation) {
            return (
              <li key={task.location}>
                <button
                  type="button"
                  onClick={() => onSelectLocation(task.location)}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition ${baseClass} ${
                    isActive ? "ring-2 ring-teal-600" : ""
                  } hover:border-teal-300`}
                >
                  {inner}
                </button>
              </li>
            );
          }

          return (
            <li
              key={task.location}
              className={`rounded-xl border px-3 py-3 ${baseClass} ${
                isActive ? "ring-2 ring-teal-600" : ""
              }`}
            >
              {inner}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
