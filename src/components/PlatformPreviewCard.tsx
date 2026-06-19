import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ImageIcon,
  Calendar,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  Share2,
  ThumbsUp,
  Briefcase,
  Globe2,
  Sparkles,
  Scissors,
  Smile,
  Megaphone,
} from "lucide-react";
import { PlatformIcon } from "@/components/PlatformIcon";
import { toast } from "sonner";

export type RefineAction = "shorter" | "emojis" | "cta";

/** Mock "AI" refinement — swap with a real edge-function call later. */
function refineCaption(caption: string, action: RefineAction): string {
  switch (action) {
    case "shorter": {
      const firstLine = caption.split(/\n+/)[0] ?? caption;
      const firstSentence = firstLine.split(/(?<=[.!?])\s+/)[0] ?? firstLine;
      const tight =
        firstSentence.length > 110 ? firstSentence.slice(0, 107) + "..." : firstSentence;
      return `${tight}\n\nLearn more 👉`;
    }
    case "emojis": {
      const sparkled = caption
        .replace(/\.\s/g, ". ✨ ")
        .replace(/!\s/g, "! 🎉 ")
        .replace(/\?\s/g, "? 🤔 ");
      return `🔥 ${sparkled} 💫`;
    }
    case "cta": {
      const body = caption
        .replace(/\n+(👉|📲|📞|🔗|Learn more|Book now|Tap|Drop|Comment).*$/is, "")
        .trim();
      const ctas = [
        "👉 Book your spot today — link in bio.",
        "📲 DM us 'YES' and we'll lock it in.",
        "🔗 Tap the link to claim your offer before it's gone.",
      ];
      const next = ctas[Math.floor(Math.random() * ctas.length)];
      return `${body}\n\n${next}`;
    }
  }
}

export type SocialPlatform = "instagram" | "facebook" | "linkedin";

export interface PlatformPreviewProps {
  platform: SocialPlatform;
  /** Account / business handle shown in the mock header */
  handle?: string;
  /** Main caption / body text — pluggable from AI response */
  caption: string;
  /** Optional CTA shown for Facebook column */
  callToAction?: string;
  /** Optional URL placeholder used in LinkedIn link card */
  linkPreview?: { title: string; domain: string };
  onCaptionChange?: (next: string) => void;
}

const meta: Record<
  SocialPlatform,
  { label: string; icon: React.ReactNode }
> = {
  instagram: {
    label: "Instagram",
    icon: <PlatformIcon platform="instagram" showLabel={false} />,
  },
  facebook: {
    label: "Facebook",
    icon: <PlatformIcon platform="facebook" showLabel={false} />,
  },
  linkedin: {
    label: "LinkedIn",
    icon: (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#0A66C2]">
        <Briefcase className="h-3.5 w-3.5 text-white" />
      </span>
    ),
  },
};

export function PlatformPreviewCard({
  platform,
  handle = "yourbusiness",
  caption,
  callToAction,
  linkPreview,
  onCaptionChange,
}: PlatformPreviewProps) {
  const { label, icon } = meta[platform];

  return (
    <Card className="p-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          {icon}
          <div className="leading-tight">
            <div className="text-sm font-semibold text-foreground">{label}</div>
            <div className="text-[11px] text-muted-foreground">@{handle}</div>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px]">
          Draft
        </Badge>
      </div>

      {/* Platform-specific body */}
      {platform === "instagram" && (
        <InstagramBody
          caption={caption}
          onCaptionChange={onCaptionChange}
        />
      )}
      {platform === "facebook" && (
        <FacebookBody
          caption={caption}
          callToAction={callToAction}
          onCaptionChange={onCaptionChange}
        />
      )}
      {platform === "linkedin" && (
        <LinkedInBody
          caption={caption}
          linkPreview={linkPreview}
          onCaptionChange={onCaptionChange}
        />
      )}

      <div className="px-4 pb-4 pt-2 mt-auto flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="shrink-0">
              <Sparkles className="h-4 w-4" />
              Refine
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-60 p-1.5">
            <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Quick AI edits
            </div>
            {(
              [
                { id: "shorter", label: "Make it shorter", icon: Scissors },
                { id: "emojis", label: "Add more emojis", icon: Smile },
                { id: "cta", label: "Change Call-to-Action", icon: Megaphone },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-foreground hover:bg-accent transition-colors text-left"
                  onClick={() => {
                    onCaptionChange?.(refineCaption(caption, opt.id));
                    toast.success(`${label} caption refined`);
                  }}
                >
                  <Icon className="h-4 w-4 text-primary" />
                  {opt.label}
                </button>
              );
            })}
          </PopoverContent>
        </Popover>

        <Button
          size="sm"
          className="flex-1"
          onClick={() => toast.success(`${label} post scheduled`)}
        >
          <Calendar className="h-4 w-4" />
          Schedule
        </Button>
      </div>
    </Card>
  );
}

/* ---------------- Platform bodies ---------------- */

function InstagramBody({
  caption,
  onCaptionChange,
}: {
  caption: string;
  onCaptionChange?: (next: string) => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="aspect-square bg-gradient-to-br from-[#FED576]/30 via-[#F47133]/20 to-[#BC3081]/20 flex flex-col items-center justify-center text-muted-foreground gap-2 border-b">
        <ImageIcon className="h-10 w-10" />
        <span className="text-xs">Square image · 1:1</span>
      </div>

      <div className="flex items-center gap-4 px-4 py-2 text-foreground">
        <Heart className="h-5 w-5" />
        <MessageCircle className="h-5 w-5" />
        <Send className="h-5 w-5" />
        <Bookmark className="h-5 w-5 ml-auto" />
      </div>

      <div className="px-4 pb-3 space-y-2">
        <Textarea
          value={caption}
          onChange={(e) => onCaptionChange?.(e.target.value)}
          className="min-h-[120px] resize-none text-xs leading-relaxed border-none p-0 focus-visible:ring-0 shadow-none"
        />
      </div>
    </div>
  );
}

function FacebookBody({
  caption,
  callToAction,
  onCaptionChange,
}: {
  caption: string;
  callToAction?: string;
  onCaptionChange?: (next: string) => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="px-4 pt-3">
        <Textarea
          value={caption}
          onChange={(e) => onCaptionChange?.(e.target.value)}
          className="min-h-[160px] resize-none text-sm leading-relaxed border-none p-0 focus-visible:ring-0 shadow-none"
        />
      </div>

      <div className="aspect-video mx-4 rounded-md border border-dashed border-border bg-muted/40 flex flex-col items-center justify-center text-muted-foreground gap-1 mt-2">
        <ImageIcon className="h-8 w-8" />
        <span className="text-[11px]">Landscape image · 16:9</span>
      </div>

      {callToAction && (
        <div className="mx-4 mt-3 rounded-md bg-secondary/60 px-3 py-2 text-xs font-medium text-foreground border">
          📣 {callToAction}
        </div>
      )}

      <Separator className="mt-3" />
      <div className="grid grid-cols-3 px-2 py-1 text-muted-foreground text-xs font-medium">
        <button className="flex items-center justify-center gap-1.5 py-2 rounded hover:bg-accent transition-colors">
          <ThumbsUp className="h-4 w-4" />
          Like
        </button>
        <button className="flex items-center justify-center gap-1.5 py-2 rounded hover:bg-accent transition-colors">
          <MessageCircle className="h-4 w-4" />
          Comment
        </button>
        <button className="flex items-center justify-center gap-1.5 py-2 rounded hover:bg-accent transition-colors text-primary">
          <Share2 className="h-4 w-4" />
          Share
        </button>
      </div>
    </div>
  );
}

function LinkedInBody({
  caption,
  linkPreview,
  onCaptionChange,
}: {
  caption: string;
  linkPreview?: { title: string; domain: string };
  onCaptionChange?: (next: string) => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="px-4 pt-3">
        <Textarea
          value={caption}
          onChange={(e) => onCaptionChange?.(e.target.value)}
          className="min-h-[200px] resize-none text-sm leading-relaxed border-none p-0 focus-visible:ring-0 shadow-none"
        />
      </div>

      {linkPreview && (
        <div className="mx-4 mt-3 mb-1 rounded-md border bg-muted/30 overflow-hidden">
          <div className="aspect-[16/8] bg-muted flex items-center justify-center text-muted-foreground">
            <Globe2 className="h-8 w-8" />
          </div>
          <div className="px-3 py-2">
            <div className="text-xs font-semibold text-foreground line-clamp-2">
              {linkPreview.title}
            </div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide mt-0.5">
              {linkPreview.domain}
            </div>
          </div>
        </div>
      )}

      <Separator className="mt-3" />
      <div className="flex items-center gap-4 px-4 py-2 text-muted-foreground text-xs font-medium">
        <button className="flex items-center gap-1.5 hover:text-foreground transition-colors">
          <ThumbsUp className="h-4 w-4" />
          Like
        </button>
        <button className="flex items-center gap-1.5 hover:text-foreground transition-colors">
          <MessageCircle className="h-4 w-4" />
          Comment
        </button>
        <button className="flex items-center gap-1.5 hover:text-foreground transition-colors">
          <Share2 className="h-4 w-4" />
          Repost
        </button>
      </div>
    </div>
  );
}
