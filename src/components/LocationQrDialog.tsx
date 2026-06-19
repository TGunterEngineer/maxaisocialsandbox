import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download, Printer, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  locationName?: string;
  googleReviewUrl?: string;
  organizationName?: string;
  primaryColor?: string | null;
}

export function LocationQrDialog({
  open,
  onOpenChange,
  locationName,
  googleReviewUrl,
  organizationName,
  primaryColor,
}: Props) {
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const [headline, setHeadline] = useState("Loved your visit?");
  const [subline, setSubline] = useState("Scan to leave us a review — it takes 30 seconds.");

  if (!googleReviewUrl) return null;

  // Only allow well-formed hex colors; otherwise fall back to default.
  const safeColor = primaryColor && /^#[0-9a-fA-F]{3,8}$/.test(primaryColor) ? primaryColor : "#3B82F6";
  const accent = safeColor;

  const downloadPng = () => {
    const canvas = canvasWrapperRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(locationName || "location").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-review-qr.png`;
    a.click();
    toast.success("QR code downloaded");
  };

  const printPoster = () => {
    const canvas = canvasWrapperRef.current?.querySelector("canvas");
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");

    const win = window.open("", "_blank", "width=820,height=1060");
    if (!win) {
      toast.error("Popup blocked — allow popups to print");
      return;
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(locationName || "Review QR")}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#0f172a;background:#fff}
  .page{width:210mm;min-height:297mm;padding:24mm 18mm;display:flex;flex-direction:column;align-items:center;text-align:center;page-break-after:always}
  .badge{display:inline-block;padding:6px 14px;border-radius:999px;background:${accent};color:#fff;font-size:14px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;margin-bottom:18px}
  h1{font-size:44px;line-height:1.1;font-weight:800;letter-spacing:-.02em;margin-bottom:14px}
  p.sub{font-size:20px;color:#475569;max-width:460px;margin:0 auto 28px}
  .stars{display:flex;justify-content:center;gap:6px;margin-bottom:28px;color:${accent}}
  .qr{padding:24px;border:3px solid ${accent};border-radius:24px;background:#fff;display:inline-block}
  .qr img{display:block;width:280px;height:280px;image-rendering:pixelated}
  .footer{margin-top:auto;padding-top:32px;font-size:14px;color:#64748b}
  .org{margin-top:18px;font-size:18px;font-weight:600;color:#0f172a}
  .loc{font-size:15px;color:#64748b;margin-top:2px}
  @media print{.page{padding:18mm}}
</style></head><body>
<div class="page">
  <span class="badge">Review us</span>
  <h1>${escapeHtml(headline)}</h1>
  <p class="sub">${escapeHtml(subline)}</p>
  <div class="stars">${"★".repeat(5).split("").map(() => `<svg width="28" height="28" viewBox="0 0 24 24" fill="${accent}"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`).join("")}</div>
  <div class="qr"><img src="${dataUrl}" alt="QR code" /></div>
  <div class="org">${escapeHtml(organizationName || "")}</div>
  <div class="loc">${escapeHtml(locationName || "")}</div>
  <div class="footer">Or visit: ${escapeHtml(googleReviewUrl)}</div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>
</body></html>`;
    win.document.write(html);
    win.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>QR code for {locationName}</DialogTitle>
          <DialogDescription>
            Print as a table tent, window decal, or receipt insert. Scans go straight to your
            Google review page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 py-2">
            <div
              ref={canvasWrapperRef}
              className="p-4 bg-white rounded-lg border-2"
              style={{ borderColor: accent }}
            >
              <QRCodeCanvas
                value={googleReviewUrl}
                size={220}
                level="H"
                includeMargin={false}
                fgColor="#0f172a"
              />
            </div>
            <div className="flex items-center gap-1" style={{ color: accent }}>
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center break-all max-w-sm">
              {googleReviewUrl}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label htmlFor="qr-headline" className="text-xs">
                Poster headline
              </Label>
              <Input
                id="qr-headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                maxLength={60}
              />
            </div>
            <div>
              <Label htmlFor="qr-subline" className="text-xs">
                Poster subtitle
              </Label>
              <Input
                id="qr-subline"
                value={subline}
                onChange={(e) => setSubline(e.target.value)}
                maxLength={120}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={downloadPng}>
            <Download className="h-4 w-4" /> Download PNG
          </Button>
          <Button onClick={printPoster}>
            <Printer className="h-4 w-4" /> Print poster
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
