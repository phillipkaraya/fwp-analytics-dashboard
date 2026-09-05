"use client";

import { useState } from "react";
import { useDashboardStore } from "@/lib/store";
import type { CreatorRecord, Platform } from "@/lib/types";
import { Section } from "@/components/charts/section";
import { PlatformBadge } from "@/components/charts/platform-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmt, platformLabel } from "@/lib/format";

const NICHES = [
  "finance",
  "entrepreneurship",
  "real_estate",
  "tech",
  "lifestyle",
  "cars",
  "comedy",
  "education",
  "other",
];

const PLATFORMS: Platform[] = ["instagram", "tiktok", "youtube", "threads"];

export function Creators() {
  const creators = useDashboardStore((s) => s.creators);
  const addCreator = useDashboardStore((s) => s.addCreator);
  const removeCreator = useDashboardStore((s) => s.removeCreator);

  const [handle, setHandle] = useState("");
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [niche, setNiche] = useState("finance");
  const [followers, setFollowers] = useState("");

  function submit() {
    if (!handle.trim()) return;
    addCreator({
      id: `c_${Date.now()}`,
      handle: handle.trim().replace(/^@/, ""),
      platform,
      niche,
      followers: parseInt(followers) || 0,
    });
    setHandle("");
    setFollowers("");
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
          {creators.length} on watch list
        </p>
        <h2 className="font-display mt-2 text-3xl font-medium text-ink">
          Creator Research
        </h2>
        <p className="mt-2 max-w-prose text-sm text-ink-soft">
          Track creators in your niche. Manual entry only — no fabricated
          numbers, no scraped data.
        </p>
      </header>

      <Section title="Add Creator">
        <div className="grid items-end gap-3 md:grid-cols-[1fr,1fr,1fr,1fr,auto]">
          <Field label="Handle">
            <Input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@username"
            />
          </Field>
          <Field label="Platform">
            <Select
              value={platform}
              onValueChange={(v) => v && setPlatform(v as Platform)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {platformLabel[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Niche">
            <Select
              value={niche}
              onValueChange={(v) => v && setNiche(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NICHES.map((n) => (
                  <SelectItem key={n} value={n}>
                    {n.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Followers">
            <Input
              type="number"
              value={followers}
              onChange={(e) => setFollowers(e.target.value)}
              placeholder="125000"
            />
          </Field>
          <Button onClick={submit} disabled={!handle.trim()}>
            Add to list
          </Button>
        </div>
      </Section>

      <Section title="Watched Creators">
        {creators.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">
            No creators tracked yet.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {creators.map((c) => (
              <CreatorCard
                key={c.id}
                creator={c}
                onRemove={() => removeCreator(c.id)}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function CreatorCard({
  creator,
  onRemove,
}: {
  creator: CreatorRecord;
  onRemove: () => void;
}) {
  const initials = creator.handle.slice(0, 2).toUpperCase();
  return (
    <div className="card card-hover p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft font-mono text-xs font-semibold text-brand-deep">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ink">
              @{creator.handle}
            </span>
            <PlatformBadge platform={creator.platform} />
          </div>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
            {creator.niche.replace(/_/g, " ")}
          </div>
        </div>
        <button
          onClick={onRemove}
          className="font-mono text-[10px] uppercase tracking-wider text-negative hover:underline"
        >
          Remove
        </button>
      </div>
      <div className="tabular mt-3 font-display text-2xl font-medium text-ink">
        {fmt(creator.followers)}
        <span className="ml-1 text-xs font-normal text-ink-muted">
          followers
        </span>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
