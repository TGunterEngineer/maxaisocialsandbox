import { useState } from "react";
import { Sparkles, Hash, MapPin, Smile, MessageSquareQuote, X } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTone, type ToneOption } from "@/contexts/ToneContext";

const SUGGESTED_HASHTAGS = [
  "#MaximumSocial",
  "#ChicagoEats",
  "#SupportLocal",
  "#FoodieGram",
  "#WeekendVibes",
  "#CoffeeLover",
  "#CraftCocktails",
  "#SmallBusiness",
  "#ChiTown",
];

const EMOJI_LABELS = ["None", "Subtle", "Balanced", "Frequent"];

export default function BrandVoice() {
  const { globalTone, setGlobalTone } = useTone();

  // Social Media Personality state
  const [emojiDensity, setEmojiDensity] = useState<number>(2);
  const [useSlang, setUseSlang] = useState(false);
  const [autoTagLocation, setAutoTagLocation] = useState(true);
  const [hashtags, setHashtags] = useState<string[]>(["#MaximumSocial", "#ChicagoEats"]);

  const toggleHashtag = (tag: string) => {
    setHashtags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleSavePersonality = () => {
    toast.success("Social personality saved", {
      description: `Emoji ${EMOJI_LABELS[emojiDensity]} · ${hashtags.length} hashtag${hashtags.length === 1 ? "" : "s"} · Applied to AI`,
    });
  };

  return (
    <DashboardLayout title="Brand Voice & Settings">
            <div className="max-w-2xl space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Brand Voice</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Define how Maximum Social speaks on your behalf — across replies, posts, and DMs.
                </p>
              </div>

              {/* --- Core brand voice --- */}
              <Card className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <MessageSquareQuote className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Core Voice</h3>
                </div>
                <div className="space-y-2">
                  <Label>Business name</Label>
                  <Input placeholder="e.g. Acme Coffee Co." />
                </div>
                <div className="space-y-2">
                  <Label>Default tone of voice</Label>
                  <Select value={globalTone} onValueChange={(v) => setGlobalTone(v as ToneOption)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="formal">Formal — Professional & structured</SelectItem>
                      <SelectItem value="friendly">Friendly — Warm & conversational</SelectItem>
                      <SelectItem value="apologetic">Apologetic — Sincere & empathetic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Brand description</Label>
                  <Textarea
                    placeholder="Describe your brand personality, values, and style..."
                    className="min-h-[120px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Words to avoid</Label>
                  <Input placeholder="e.g. cheap, basic, simple" />
                </div>
                <div className="flex justify-end">
                  <Button variant="outline">Save core voice</Button>
                </div>
              </Card>

              {/* --- Social Media Personality --- */}
              <Card className="p-5 space-y-6 border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Social Media Personality</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Fine-tune how the AI sounds on Instagram, Facebook & X.
                  </p>
                </div>

                {/* Emoji Density */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smile className="h-3.5 w-3.5 text-muted-foreground" />
                      <Label className="text-sm">Emoji Density</Label>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {EMOJI_LABELS[emojiDensity]}
                    </Badge>
                  </div>
                  <Slider
                    value={[emojiDensity]}
                    onValueChange={(v) => setEmojiDensity(v[0])}
                    min={0}
                    max={3}
                    step={1}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
                    {EMOJI_LABELS.map((l) => (
                      <span key={l}>{l}</span>
                    ))}
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-md border bg-card/60 px-3 py-2.5">
                    <div className="space-y-0.5">
                      <Label htmlFor="slang" className="text-sm cursor-pointer">
                        Use Slang / Industry Jargon
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Allow casual phrasing and trade lingo where it fits.
                      </p>
                    </div>
                    <Switch id="slang" checked={useSlang} onCheckedChange={setUseSlang} />
                  </div>

                  <div className="flex items-center justify-between rounded-md border bg-card/60 px-3 py-2.5">
                    <div className="space-y-0.5">
                      <Label htmlFor="geo" className="text-sm cursor-pointer flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        Auto-tag Local Location
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Add city/neighborhood tags to outgoing social posts.
                      </p>
                    </div>
                    <Switch id="geo" checked={autoTagLocation} onCheckedChange={setAutoTagLocation} />
                  </div>
                </div>

                {/* Core Hashtags */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                      <Label className="text-sm">Core Hashtags</Label>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {hashtags.length} selected
                    </span>
                  </div>

                  {hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 rounded-md border bg-card/60 p-2 min-h-[44px]">
                      {hashtags.map((t) => (
                        <Badge
                          key={t}
                          className="bg-primary/15 text-primary border-primary/30 hover:bg-primary/25 cursor-pointer pl-2 pr-1 gap-1"
                          variant="outline"
                          onClick={() => toggleHashtag(t)}
                        >
                          {t}
                          <X className="h-3 w-3" />
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1.5">Suggestions</p>
                    <div className="flex flex-wrap gap-1.5">
                      {SUGGESTED_HASHTAGS.filter((t) => !hashtags.includes(t)).map((t) => (
                        <Badge
                          key={t}
                          variant="outline"
                          className="cursor-pointer hover:bg-accent text-muted-foreground"
                          onClick={() => toggleHashtag(t)}
                        >
                          + {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-border/50">
                  <Button onClick={handleSavePersonality} className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    Save & Apply to AI
                  </Button>
                </div>
              </Card>
            </div>
    </DashboardLayout>
  );
}
