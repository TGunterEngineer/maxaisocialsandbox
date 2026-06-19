import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, Lightbulb, Star, Wand2, Loader2, CheckCircle2, Trophy, ArrowRight } from "lucide-react";
import { PlatformIcon, type Platform as IconPlatform } from "@/components/PlatformIcon";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
// Real reviews are loaded via the Reviews hook elsewhere; spotlight on this page
// intentionally has no mock seed data so brand-new orgs see an empty state.
const mockReviews: Array<{
  id: string;
  kind: string;
  rating?: number | null;
  customerName: string;
  text: string;
  platform?: string;
}> = [];
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import { PlatformPreviewCard, type SocialPlatform } from "@/components/PlatformPreviewCard";

interface GeneratedPost {
  platform: SocialPlatform;
  caption: string;
  callToAction?: string;
  linkPreview?: { title: string; domain: string };
}

async function generatePostsAI(goal: string, toneLabel: string): Promise<GeneratedPost[]> {
  const { data, error } = await supabase.functions.invoke("generate-social-posts", {
    body: { goal, tone: toneLabel },
  });
  if (error) throw new Error(error.message || "Failed to generate posts");
  if (!data?.posts) throw new Error(data?.error || "No posts returned");
  return data.posts as GeneratedPost[];
}

const TONES = [
  { id: "professional", label: "Professional" },
  { id: "local", label: "Local/Friendly" },
  { id: "urgent", label: "Urgent/Salesy" },
] as const;
type ToneId = (typeof TONES)[number]["id"];

const BRAINSTORM_STEPS = [
  "AI is analyzing your idea...",
  "Crafting platform-specific hooks...",
  "Polishing captions for each channel...",
] as const;

export default function PostCreator() {
  const [mode, setMode] = useState<"concept" | "review">("concept");
  const [concept, setConcept] = useState("");
  const [reviewId, setReviewId] = useState<string>("");
  const [posts, setPosts] = useState<GeneratedPost[] | null>(null);
  const [generating, setGenerating] = useState(false);

  // Brainstorming workspace state
  const [goal, setGoal] = useState("");
  const [tone, setTone] = useState<ToneId>("local");
  const [campaignRunning, setCampaignRunning] = useState(false);
  const [campaignStep, setCampaignStep] = useState(0);

  // Advance the "thinking" step indicator while the AI request is in flight.
  useEffect(() => {
    if (!campaignRunning) return;
    if (campaignStep >= BRAINSTORM_STEPS.length - 1) return;
    const next = setTimeout(() => setCampaignStep((s) => s + 1), 900);
    return () => clearTimeout(next);
  }, [campaignRunning, campaignStep]);

  const handleGenerateCampaign = async () => {
    if (!goal.trim()) {
      toast.error("Tell the AI what the goal is first");
      return;
    }
    const toneLabel = TONES.find((t) => t.id === tone)?.label ?? "Friendly";
    setCampaignStep(0);
    setCampaignRunning(true);
    try {
      const next = await generatePostsAI(goal, toneLabel);
      setPosts(next);
      toast.success("Social campaign generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate campaign");
    } finally {
      setCampaignRunning(false);
    }
  };

  const handleTurnIntoPost = (reviewId: string) => {
    const review = mockReviews.find((r) => r.id === reviewId);
    if (!review) return;
    setMode("concept");
    setGoal(
      `Generate a celebratory social media post based on this 5-star review from ${review.customerName}: "${review.text}"`,
    );
    setTone("local");
    toast.success(`Loaded review from ${review.customerName} into the workspace`);
    setTimeout(() => {
      document.getElementById("goal")?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById("goal")?.focus();
    }, 50);
  };

  const fiveStarReviews = useMemo(
    () => mockReviews.filter((r) => r.kind === "review" && (r.rating ?? 0) >= 5),
    [],
  );

  const spotlightOptions = useMemo(() => {
    if (fiveStarReviews.length > 0) return fiveStarReviews;
    return [...mockReviews]
      .filter((r) => r.kind === "review")
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 5);
  }, [fiveStarReviews]);

  const handleGenerate = async () => {
    let seed = "";
    const toneLabel = TONES.find((t) => t.id === tone)?.label ?? "Friendly";
    if (mode === "concept") {
      if (!concept.trim()) {
        toast.error("Describe your post idea first");
        return;
      }
      seed = concept;
    } else {
      const review = mockReviews.find((r) => r.id === reviewId);
      if (!review) {
        toast.error("Pick a review to spotlight");
        return;
      }
      seed = `Our customer ${review.customerName} just shared: "${review.text}"`;
    }

    setGenerating(true);
    try {
      const next = await generatePostsAI(seed, toneLabel);
      setPosts(next);
      toast.success("Drafts ready across 3 channels");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate drafts");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <DashboardLayout title="Post Creator">
            <div className="max-w-7xl mx-auto grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-6 min-w-0">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Create a new post</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Start from a fresh idea or amplify a glowing review across every channel.
                  </p>
                </div>

              <Card className="p-6 space-y-5 bg-gradient-to-br from-card to-muted/30 border-2">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    Brainstorming Workspace
                  </h3>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="goal" className="text-sm font-medium">
                    What are we promoting?
                  </Label>
                  <Textarea
                    id="goal"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="What's the goal? (e.g., We're having a 20% off summer sale on HVAC tune-ups this weekend in Martinez)."
                    className="min-h-[140px] resize-none text-base leading-relaxed"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Tone</Label>
                  <div className="flex flex-wrap gap-2">
                    {TONES.map((t) => {
                      const active = tone === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTone(t.id)}
                          className={cn(
                            "px-4 py-2 rounded-full text-sm font-medium border transition-all",
                            active
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-background text-foreground border-border hover:border-primary/50 hover:bg-accent",
                          )}
                          aria-pressed={active}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Button
                  size="lg"
                  className="w-full h-12 text-base font-semibold"
                  onClick={handleGenerateCampaign}
                  disabled={campaignRunning}
                >
                  <Wand2 className="h-5 w-5" />
                  {campaignRunning ? "Generating..." : "Generate Social Campaign"}
                </Button>

                {campaignRunning && (
                  <div className="rounded-lg border bg-background/60 p-4 space-y-2">
                    {BRAINSTORM_STEPS.slice(0, campaignStep + 1).map((step, idx) => {
                      const isCurrent = idx === campaignStep;
                      return (
                        <div
                          key={step}
                          className={cn(
                            "flex items-center gap-2 text-sm transition-opacity",
                            isCurrent ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {isCurrent ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          )}
                          <span>{step}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              <Card className="p-5 space-y-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    Quick Start
                  </h3>
                </div>

                <Tabs value={mode} onValueChange={(v) => setMode(v as "concept" | "review")}>
                  <TabsList className="grid w-full grid-cols-2 max-w-md">
                    <TabsTrigger value="concept" className="gap-2">
                      <Lightbulb className="h-4 w-4" />
                      New Concept
                    </TabsTrigger>
                    <TabsTrigger value="review" className="gap-2">
                      <Star className="h-4 w-4" />
                      Review Spotlight
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="concept" className="mt-4 space-y-2">
                    <Label htmlFor="concept">Describe your post idea</Label>
                    <Textarea
                      id="concept"
                      value={concept}
                      onChange={(e) => setConcept(e.target.value)}
                      placeholder="e.g. Announce our new fall menu launching this Friday — cozy, seasonal, and locally sourced."
                      className="min-h-[120px] resize-none"
                    />
                  </TabsContent>

                  <TabsContent value="review" className="mt-4 space-y-2">
                    <Label>Pick a recent 5-star review</Label>
                    <Select value={reviewId} onValueChange={setReviewId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a review to spotlight..." />
                      </SelectTrigger>
                      <SelectContent>
                        {spotlightOptions.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {"⭐".repeat(r.rating ?? 0)} — {r.customerName}: {r.text.slice(0, 60)}
                            {r.text.length > 60 ? "..." : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end">
                  <Button onClick={handleGenerate} disabled={generating}>
                    <Sparkles className="h-4 w-4" />
                    {generating ? "Generating..." : "Generate"}
                  </Button>
                </div>
              </Card>

              {posts && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    Platform Previews
                  </h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    {posts.map((p) => (
                      <PlatformPreviewCard
                        key={p.platform}
                        platform={p.platform}
                        caption={p.caption}
                        callToAction={p.callToAction}
                        linkPreview={p.linkPreview}
                        onCaptionChange={(next) =>
                          setPosts((prev) =>
                            prev
                              ? prev.map((x) =>
                                  x.platform === p.platform ? { ...x, caption: next } : x,
                                )
                              : prev,
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
              </div>

              <aside className="space-y-3 xl:sticky xl:top-6 xl:self-start">
                <Card className="p-5 space-y-4 border-2 bg-gradient-to-b from-amber-50/50 to-card dark:from-amber-950/20">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                      Recent Wins
                    </h3>
                  </div>
                  <p className="text-xs text-amber-900/80 dark:text-amber-200/80 -mt-2">
                    Turn your latest 5-star reviews into shareable social posts.
                  </p>

                  {fiveStarReviews.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic py-4 text-center">
                      No 5-star reviews yet — check back soon!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {fiveStarReviews.slice(0, 5).map((review) => (
                        <div
                          key={review.id}
                          className="rounded-lg border bg-card p-3 space-y-2 hover:border-primary/50 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <PlatformIcon
                                platform={review.platform as IconPlatform}
                                showLabel={false}
                              />
                              <span className="text-xs font-semibold text-foreground truncate">
                                {review.customerName}
                              </span>
                            </div>
                            <div
                              className="flex items-center gap-0.5 shrink-0"
                              aria-label={`${review.rating} stars`}
                            >
                              {Array.from({ length: review.rating ?? 0 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className="h-3 w-3 fill-amber-400 text-amber-400"
                                />
                              ))}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                            "{review.text}"
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-8 text-xs"
                            onClick={() => handleTurnIntoPost(review.id)}
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            Turn into Post
                            <ArrowRight className="h-3.5 w-3.5 ml-auto" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </aside>
            </div>
    </DashboardLayout>
  );
}
