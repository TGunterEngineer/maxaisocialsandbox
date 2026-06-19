import { useMemo, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { PlatformIcon, type Platform } from "@/components/PlatformIcon";
import { cn } from "@/lib/utils";

type EventType = "scheduled" | "completed" | "draft";

interface CalendarEvent {
  id: string;
  date: Date; // day-of-month within current view month
  type: EventType;
  title: string;
  caption: string;
  platform: Platform | "twitter";
  time?: string;
}

const typeMeta: Record<EventType, { label: string; dot: string; chip: string }> = {
  scheduled: {
    label: "Scheduled Post",
    dot: "bg-emerald-500",
    chip: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  completed: {
    label: "Completed Reply",
    dot: "bg-sky-500",
    chip: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  },
  draft: {
    label: "Draft",
    dot: "bg-muted-foreground",
    chip: "bg-muted text-muted-foreground border-border",
  },
};

// Real scheduled posts will be loaded from the database here. For now, no mock
// events are seeded so non-demo users see a clean, empty calendar.
function buildMockEvents(_monthAnchor: Date): CalendarEvent[] {
  return [];
}

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ContentCalendar() {
  const [monthAnchor, setMonthAnchor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const events = useMemo(() => buildMockEvents(monthAnchor), [monthAnchor]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthAnchor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(monthAnchor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [monthAnchor]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = format(e.date, "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return map;
  }, [events]);

  const selectedEvents = selectedDay
    ? eventsByDay.get(format(selectedDay, "yyyy-MM-dd")) ?? []
    : [];

  const stats = useMemo(() => {
    return {
      scheduled: events.filter((e) => e.type === "scheduled").length,
      completed: events.filter((e) => e.type === "completed").length,
      draft: events.filter((e) => e.type === "draft").length,
    };
  }, [events]);

  return (
    <DashboardLayout title="Content Calendar">
            {/* Toolbar */}
            <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
              <div>
                <div className="flex items-center gap-3">
                  <CalendarIcon className="h-5 w-5 text-primary" />
                  <h2 className="text-2xl font-bold text-foreground">
                    {format(monthAnchor, "MMMM yyyy")}
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Plan, schedule, and visualize your publishing pipeline.
                </p>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                {/* Legend */}
                <div className="flex items-center gap-3 text-xs">
                  <LegendDot color="bg-emerald-500" label={`Scheduled · ${stats.scheduled}`} />
                  <LegendDot color="bg-sky-500" label={`Completed · ${stats.completed}`} />
                  <LegendDot color="bg-muted-foreground" label={`Drafts · ${stats.draft}`} />
                </div>

                <div className="flex items-center gap-1 rounded-md border bg-card p-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setMonthAnchor((m) => subMonths(m, 1))}
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => setMonthAnchor(new Date())}
                  >
                    Today
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setMonthAnchor((m) => addMonths(m, 1))}
                    aria-label="Next month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Calendar grid */}
            <div className="rounded-lg border bg-card overflow-hidden">
              {/* Weekday header */}
              <div className="grid grid-cols-7 border-b bg-muted/30">
                {weekdayLabels.map((d) => (
                  <div
                    key={d}
                    className="px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Days */}
              <div className="grid grid-cols-7 auto-rows-fr">
                {days.map((day, i) => {
                  const inMonth = isSameMonth(day, monthAnchor);
                  const isToday = isSameDay(day, new Date());
                  const dayEvents = eventsByDay.get(format(day, "yyyy-MM-dd")) ?? [];
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDay(day)}
                      className={cn(
                        "min-h-[110px] text-left p-2 border-r border-b last:border-r-0 transition-colors group relative",
                        "hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none",
                        !inMonth && "bg-muted/20",
                        (i + 1) % 7 === 0 && "border-r-0",
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center justify-center text-xs font-semibold",
                            isToday
                              ? "h-6 w-6 rounded-full bg-primary text-primary-foreground"
                              : inMonth
                              ? "text-foreground"
                              : "text-muted-foreground/50",
                          )}
                        >
                          {format(day, "d")}
                        </span>
                        {dayEvents.length > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            {dayEvents.length}
                          </span>
                        )}
                      </div>

                      {/* Event rows (max 2 visible, then +N) */}
                      <div className="space-y-1">
                        {dayEvents.slice(0, 2).map((ev) => (
                          <div
                            key={ev.id}
                            className={cn(
                              "flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px] truncate border",
                              typeMeta[ev.type].chip,
                            )}
                          >
                            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", typeMeta[ev.type].dot)} />
                            <span className="truncate text-foreground/90 font-medium">
                              {ev.title}
                            </span>
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-[10px] text-muted-foreground pl-1">
                            +{dayEvents.length - 2} more
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

      {/* Day detail drawer */}
      <Sheet open={!!selectedDay} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" />
              {selectedDay ? format(selectedDay, "EEEE, MMMM d") : ""}
            </SheetTitle>
            <SheetDescription>
              {selectedEvents.length === 0
                ? "Nothing scheduled for this day."
                : `${selectedEvents.length} item${selectedEvents.length > 1 ? "s" : ""} on this day.`}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-3">
            {selectedEvents.map((ev) => (
              <div
                key={ev.id}
                className="rounded-lg border bg-card/60 p-4 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    {ev.platform !== "twitter" ? (
                      <PlatformIcon platform={ev.platform as Platform} showLabel={false} />
                    ) : (
                      <div className="h-7 w-7 rounded-md bg-foreground/90 text-background flex items-center justify-center text-xs font-bold">
                        X
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-semibold text-foreground leading-tight">
                        {ev.title}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {ev.time}
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] px-2 py-0.5 shrink-0", typeMeta[ev.type].chip)}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full mr-1", typeMeta[ev.type].dot)} />
                    {typeMeta[ev.type].label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mt-2 border-l-2 border-border pl-3">
                  {ev.caption}
                </p>
              </div>
            ))}

            {selectedEvents.length === 0 && (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Click a day with a colored chip to see content details.
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <span className={cn("h-2 w-2 rounded-full", color)} />
      <span>{label}</span>
    </div>
  );
}
