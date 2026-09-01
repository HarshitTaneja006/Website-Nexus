"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { OPS_EVENT } from "@/components/site/ops-console";
import { SHORTCUTS_EVENT } from "@/components/site/shortcuts-dialog";

/**
 * CommandPalette - a terminal-styled ⌘K launcher.
 * Navigate sections, switch the hero ASCII engine, or run quick actions.
 * Hero engine switching rides on a CustomEvent so components stay decoupled.
 */

export const ENGINE_EVENT = "nexus:engine";

const SECTIONS = [
  { href: "#top", label: "TOP", hint: "back to the surface" },
  { href: "#forge", label: "FOUNDRY", hint: "ascii particle forge - words from glyphs" },
  { href: "#about", label: "MANIFESTO", hint: "what nexus compiles" },
  { href: "#events", label: "EVENTS", hint: "transmit schedule + rsvp" },
  { href: "#news", label: "NEWS", hint: "live uplink" },
  { href: "#stack", label: "STACK", hint: "five domains, one workbench" },
  { href: "#gallery", label: "GALLERY", hint: "ascii cam feed" },
  { href: "#team", label: "CREW", hint: "the bridge crew" },
  { href: "#join", label: "JOIN", hint: "transmit application" },
];

const ENGINES = ["rain", "wave", "donut", "cam"] as const;

export function CommandPalette({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const run = useCallback(
    (fn: () => void) => {
      setOpen(false);
      // let the dialog close before jumping
      setTimeout(fn, 60);
    },
    [setOpen]
  );

  const jump = useCallback(
    (href: string) => run(() => document.querySelector(href)?.scrollIntoView({ behavior: "smooth" })),
    [run]
  );

  const setEngine = useCallback(
    (p: string) =>
      run(() => {
        window.dispatchEvent(new CustomEvent(ENGINE_EVENT, { detail: p }));
        toast({ title: "BG_ENGINE SWITCHED", description: `ascii preset → ${p}` });
      }),
    [run, toast]
  );

  const replayBoot = useCallback(
    () =>
      run(() => {
        sessionStorage.removeItem("nexus-booted");
        router.refresh();
        setTimeout(() => window.location.reload(), 80);
      }),
    [run, router]
  );

  const copyEmail = useCallback(
    () =>
      run(async () => {
        try {
          await navigator.clipboard.writeText("nexusvitc@gmail.com");
          toast({ title: "COPIED", description: "nexusvitc@gmail.com → clipboard" });
        } catch {
          toast({ title: "CLIPBOARD BLOCKED", description: "nexusvitc@gmail.com", variant: "destructive" });
        }
      }),
    [run, toast]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const groups = useMemo(
    () => [
      { title: "NAVIGATE", items: SECTIONS },
      {
        title: "ASCII ENGINE",
        items: ENGINES.map((e) => ({
          label: e.toUpperCase(),
          hint: e === "cam" ? "live webcam → ascii feed" : `hero preset: ${e}`,
          engine: e,
        })),
      },
    ],
    []
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen} className="border-primary/25">
      <CommandInput
        placeholder="type a command… (⌘K)"
        className="font-mono text-sm placeholder:text-muted-foreground/50"
      />
      <CommandList className="thin-scroll font-mono">
        <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
          <span className="text-amber-300">404</span> · command not found. try `help` → just kidding, pick from the list.
        </CommandEmpty>
        <CommandGroup heading="NAVIGATE">
          {groups[0].items.map((s) => (
            <CommandItem
              key={s.href}
              value={`go ${s.label} ${s.hint}`}
              onSelect={() => jump(s.href)}
              className="gap-3 text-xs"
            >
              <span className="text-primary/60">→</span>
              <span className="font-bold tracking-widest">{s.label}</span>
              <span className="ml-auto text-[10px] text-muted-foreground/60">./{s.hint}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="ASCII ENGINE">
          {groups[1].items.map((e) => (
            <CommandItem
              key={e.engine}
              value={`engine ${e.label}`}
              onSelect={() => setEngine(e.engine as string)}
              className="gap-3 text-xs"
            >
              <span className="text-amber-300/80">▚</span>
              <span className="font-bold tracking-widest">{e.label}</span>
              <span className="ml-auto text-[10px] text-muted-foreground/60">./{e.hint}</span>
            </CommandItem>
          ))}
          <CommandItem
            value="dump hero frame txt artifact glyphs"
            onSelect={() =>
              run(() => window.dispatchEvent(new CustomEvent("nexus:hero-dump", { detail: { format: "txt" } })))
            }
            className="gap-3 text-xs"
          >
            <span className="text-primary/60">⤓</span>
            <span className="font-bold tracking-widest">DUMP FRAME.TXT</span>
            <span className="ml-auto text-[10px] text-muted-foreground/60">./live engine grid → artifact</span>
          </CommandItem>
          <CommandItem
            value="print hero frame png typographic"
            onSelect={() =>
              run(() => window.dispatchEvent(new CustomEvent("nexus:hero-dump", { detail: { format: "png" } })))
            }
            className="gap-3 text-xs"
          >
            <span className="text-primary/60">⤓</span>
            <span className="font-bold tracking-widest">PRINT FRAME.PNG</span>
            <span className="ml-auto text-[10px] text-muted-foreground/60">./glyph grid → typographic print</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="ACTIONS">
          <CommandItem value="replay boot sequence" onSelect={replayBoot} className="gap-3 text-xs">
            <span className="text-primary/60">↻</span>
            <span className="font-bold tracking-widest">REPLAY BOOT</span>
            <span className="ml-auto text-[10px] text-muted-foreground/60">./reload the boot sequence</span>
          </CommandItem>
          <CommandItem value="copy club email contact" onSelect={copyEmail} className="gap-3 text-xs">
            <span className="text-primary/60">✉</span>
            <span className="font-bold tracking-widest">COPY EMAIL</span>
            <span className="ml-auto text-[10px] text-muted-foreground/60">./nexusvitc@gmail.com</span>
          </CommandItem>
          <CommandItem
            value="ops console admin stats rsvp join"
            onSelect={() =>
              run(() => window.dispatchEvent(new CustomEvent(OPS_EVENT)))
            }
            className="gap-3 text-xs"
          >
            <span className="text-amber-300/80">#</span>
            <span className="font-bold tracking-widest">OPS CONSOLE</span>
            <span className="ml-auto text-[10px] text-muted-foreground/60">./rsvp + join ledger</span>
          </CommandItem>
          <CommandItem
            value="shortcuts manual keys help man deep links"
            onSelect={() =>
              run(() => window.dispatchEvent(new CustomEvent(SHORTCUTS_EVENT)))
            }
            className="gap-3 text-xs"
          >
            <span className="text-primary/60">?</span>
            <span className="font-bold tracking-widest">SHORTCUTS</span>
            <span className="ml-auto text-[10px] text-muted-foreground/60">./keys · deep links · feeds</span>
          </CommandItem>
          <CommandItem
            value="open source github"
            onSelect={() =>
              run(() => window.open("https://github.com/harshittaneja006/nexus-website", "_blank", "noopener"))
            }
            className="gap-3 text-xs"
          >
            <span className="text-primary/60">⌥</span>
            <span className="font-bold tracking-widest">SOURCE</span>
            <span className="ml-auto text-[10px] text-muted-foreground/60">./github upstream</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
      <div className="flex items-center justify-between border-t border-border/60 px-4 py-2 font-mono text-[9px] tracking-widest text-muted-foreground/60">
        <span>NEXUS SHELL v2.6</span>
        <span>ESC TO CLOSE</span>
      </div>
    </CommandDialog>
  );
}
