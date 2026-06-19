import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  /** Show a subtle dashed border + tinted background. Default true. */
  bordered?: boolean;
}

/**
 * Friendly, consistent empty state for first-use / no-data screens.
 * Use inside a Card or directly within a page section.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  bordered = true,
}: EmptyStateProps) {
  return (
    <div
      className={
        bordered
          ? "rounded-lg border border-dashed bg-muted/20 px-6 py-12 text-center"
          : "px-6 py-12 text-center"
      }
    >
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
      {action && (
        <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
          {action}
        </div>
      )}
    </div>
  );
}
