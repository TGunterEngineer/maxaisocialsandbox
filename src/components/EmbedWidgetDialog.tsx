import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

const PROJECT_REF = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const WIDGET_JS = `https://${PROJECT_REF}.functions.supabase.co/widget-js`;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  locationId?: string;
  locationName?: string;
}

export function EmbedWidgetDialog({
  open,
  onOpenChange,
  organizationId,
  locationId,
  locationName,
}: Props) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [copied, setCopied] = useState(false);

  const snippet = `<script
  src="${WIDGET_JS}"
  data-maxai-widget
  data-org="${organizationId}"${locationId ? `\n  data-location="${locationId}"` : ""}
  data-theme="${theme}"
  data-limit="5"
  async
></script>`;

  const copy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    toast.success("Snippet copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Embed reviews widget{locationName ? ` — ${locationName}` : ""}</DialogTitle>
          <DialogDescription>
            Paste this snippet anywhere on your website to display recent reviews and an average
            rating. Updates automatically as new reviews come in.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={theme} onValueChange={(v) => setTheme(v as "light" | "dark")}>
          <TabsList>
            <TabsTrigger value="light">Light</TabsTrigger>
            <TabsTrigger value="dark">Dark</TabsTrigger>
          </TabsList>
          <TabsContent value={theme} className="mt-4 space-y-3">
            <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
              <code>{snippet}</code>
            </pre>
            <div className="flex justify-end">
              <Button onClick={copy} size="sm">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy snippet"}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <strong className="text-foreground">Where to paste:</strong> anywhere in your
                site's HTML — homepage, footer, dedicated reviews page.
              </p>
              <p>
                <strong className="text-foreground">Performance:</strong> loads asynchronously,
                renders inside a Shadow DOM so it won't conflict with your site's CSS.
              </p>
              <p>
                <strong className="text-foreground">Customize:</strong> change{" "}
                <code className="text-foreground">data-limit</code> (max 20) or{" "}
                <code className="text-foreground">data-theme</code> (<em>light</em> /{" "}
                <em>dark</em>).
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
