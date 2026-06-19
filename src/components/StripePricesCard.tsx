import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type StripeEnv = "sandbox" | "live";

type Price = {
  id: string;
  lookup_key: string | null;
  nickname: string | null;
  unit_amount: number | null;
  currency: string;
  recurring: { interval: string; interval_count: number } | null;
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  plan_tier: string | null;
  metadata: Record<string, string>;
  prices: Price[];
};

type CatalogData = {
  generatedAt: string;
  catalog: Record<string, Product[]>;
  errors: Record<string, string>;
};

type FlatRow = {
  priceId: string;
  lookupKey: string;
  productName: string;
  amount: number | null;
  currency: string;
  type: "monthly" | "yearly" | "weekly" | "daily" | "one-time" | string;
  active: boolean;
};

function flatten(products: Product[] | undefined): FlatRow[] {
  if (!products) return [];
  const rows: FlatRow[] = [];
  for (const p of products) {
    for (const pr of p.prices) {
      let type: FlatRow["type"] = "one-time";
      if (pr.recurring) {
        const i = pr.recurring.interval;
        type = i === "month"
          ? "monthly"
          : i === "year"
          ? "yearly"
          : i === "week"
          ? "weekly"
          : i === "day"
          ? "daily"
          : i;
      }
      rows.push({
        priceId: pr.id,
        lookupKey: pr.lookup_key ?? pr.nickname ?? pr.id,
        productName: p.name,
        amount: pr.unit_amount,
        currency: pr.currency,
        type,
        active: true,
      });
    }
  }
  return rows.sort((a, b) => a.lookupKey.localeCompare(b.lookupKey));
}

interface Props {
  catalog: CatalogData | undefined;
  loading: boolean;
  fetching: boolean;
  onSync: () => void;
}

export function StripePricesCard({ catalog, loading, fetching, onSync }: Props) {
  const available: StripeEnv[] = useMemo(() => {
    const keys = Object.keys(catalog?.catalog ?? {}) as StripeEnv[];
    return keys.length ? keys : ["sandbox", "live"];
  }, [catalog]);

  const [env, setEnv] = useState<StripeEnv>(available[0] ?? "sandbox");
  const rows = useMemo(() => flatten(catalog?.catalog?.[env]), [catalog, env]);
  const error = catalog?.errors?.[env];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle>Stripe Prices</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-md border bg-muted/40 p-0.5 text-sm">
              {(["sandbox", "live"] as StripeEnv[]).map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEnv(e)}
                  className={cn(
                    "px-3 py-1 rounded capitalize transition-colors",
                    env === e
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={onSync} disabled={fetching}>
              <RefreshCw className={cn("h-4 w-4 mr-2", fetching && "animate-spin")} />
              Sync
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Verifies the lookup_keys used by the pricing page resolve to real Stripe prices in {env}.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lookup Key</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-sm">
                      No active prices in {env}.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.priceId}>
                      <TableCell>
                        <code className="text-xs font-mono text-foreground">{r.lookupKey}</code>
                      </TableCell>
                      <TableCell className="text-sm">{r.productName}</TableCell>
                      <TableCell className="text-sm font-medium">
                        {r.amount != null
                          ? new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: r.currency.toUpperCase(),
                            }).format(r.amount / 100)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">{r.type}</Badge>
                      </TableCell>
                      <TableCell>
                        {r.active ? (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
