import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Eye, RotateCw, Loader2, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Webhook } from "lucide-react";

type Delivery = {
  id: string;
  endpoint_id: string;
  event_type: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_response_status: number | null;
  last_error: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

type EndpointMap = Record<string, { name: string; url: string }>;

interface Props {
  organizationId: string;
  endpoints: Array<{ id: string; name: string; url: string }> | undefined;
}

function StatusBadge({ delivery }: { delivery: Delivery }) {
  const code = delivery.last_response_status;
  if (delivery.status === "success") {
    return (
      <Badge className="bg-primary/15 text-primary border-primary/30 hover:bg-primary/20" variant="outline">
        {code ?? 200}
      </Badge>
    );
  }
  if (delivery.status === "failed") {
    return (
      <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
        {code ?? "Failed"}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
      {code ? `Retrying · ${code}` : "Pending"}
    </Badge>
  );
}

export function WebhookDeliveriesTable({ organizationId, endpoints }: Props) {
  const qc = useQueryClient();
  const [payloadOpen, setPayloadOpen] = useState<Delivery | null>(null);

  const endpointMap = useMemo<EndpointMap>(() => {
    const map: EndpointMap = {};
    for (const ep of endpoints ?? []) {
      map[ep.id] = { name: ep.name, url: ep.url };
    }
    return map;
  }, [endpoints]);

  const { data, isLoading } = useQuery({
    queryKey: ["webhook_deliveries_full", organizationId],
    queryFn: async (): Promise<Delivery[]> => {
      const { data, error } = await supabase
        .from("webhook_deliveries")
        .select(
          "id, endpoint_id, event_type, status, attempts, max_attempts, last_response_status, last_error, payload, created_at",
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Delivery[];
    },
    enabled: !!organizationId,
    refetchInterval: 10_000,
  });

  const retryMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("retry_webhook_delivery", {
        _delivery_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Delivery re-queued — next dispatch will retry it");
      qc.invalidateQueries({ queryKey: ["webhook_deliveries_full", organizationId] });
      qc.invalidateQueries({ queryKey: ["webhook_deliveries", organizationId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns = useMemo<ColumnDef<Delivery>[]>(
    () => [
      {
        accessorKey: "event_type",
        header: "Event",
        cell: ({ row }) => (
          <Badge variant="outline" className="font-mono text-[10px]">
            {row.original.event_type}
          </Badge>
        ),
      },
      {
        id: "url",
        header: "Target URL",
        cell: ({ row }) => {
          const ep = endpointMap[row.original.endpoint_id];
          if (!ep) {
            return <span className="text-xs text-muted-foreground">Deleted endpoint</span>;
          }
          return (
            <div className="min-w-0 max-w-[280px]">
              <div className="text-xs font-medium truncate">{ep.name}</div>
              <a
                href={ep.url}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 truncate max-w-full"
              >
                <span className="truncate">{ep.url}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            </div>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge delivery={row.original} />,
      },
      {
        id: "attempts",
        header: "Attempt",
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-muted-foreground">
            {row.original.attempts} / {row.original.max_attempts}
          </span>
        ),
      },
      {
        accessorKey: "created_at",
        header: "Timestamp",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground" title={new Date(row.original.created_at).toLocaleString()}>
            {formatDistanceToNow(new Date(row.original.created_at), { addSuffix: true })}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const d = row.original;
          const canRetry = d.status === "failed";
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPayloadOpen(d)}
                className="h-8 gap-1.5"
              >
                <Eye className="h-3.5 w-3.5" /> Payload
              </Button>
              {canRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => retryMut.mutate(d.id)}
                  disabled={retryMut.isPending && retryMut.variables === d.id}
                  className="h-8 gap-1.5 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
                >
                  {retryMut.isPending && retryMut.variables === d.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCw className="h-3.5 w-3.5" />
                  )}
                  Retry
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [endpointMap, retryMut],
  );

  const table = useReactTable({
    data: data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Delivery log</CardTitle>
        <CardDescription>
          Recent webhook attempts for this organization. Failed deliveries can be re-queued for immediate retry.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !data?.length ? (
          <EmptyState
            icon={Webhook}
            title="No deliveries yet"
            description="Once an event fires for one of your endpoints, every delivery attempt will show up here."
          />
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id}>
                      {hg.headers.map((h) => (
                        <TableHead key={h.id} className="text-xs">
                          {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {table.getPageCount() > 1 && (
              <div className="flex items-center justify-between gap-4 mt-3">
                <span className="text-xs text-muted-foreground">
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={!!payloadOpen} onOpenChange={(v) => !v && setPayloadOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Payload
              {payloadOpen && (
                <Badge variant="outline" className="font-mono text-[10px]">
                  {payloadOpen.event_type}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Exact JSON body sent to your endpoint. Headers include <code className="text-xs">X-MS-Signature</code> for HMAC verification.
            </DialogDescription>
          </DialogHeader>
          {payloadOpen?.last_error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-xs px-3 py-2">
              <span className="font-medium">Last error:</span> {payloadOpen.last_error}
            </div>
          )}
          <ScrollArea className="max-h-[60vh] rounded-md border bg-muted/40">
            <pre className="text-xs p-4 font-mono leading-relaxed">
              {payloadOpen ? JSON.stringify(payloadOpen.payload, null, 2) : ""}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
