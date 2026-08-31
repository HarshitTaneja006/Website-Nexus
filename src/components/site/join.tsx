"use client";

import { useState } from "react";
import { Github, Instagram, Linkedin, Mail, MapPin, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useReveal } from "@/components/site/use-reveal";

const BRANCHES = ["CSE Core", "CSE Spec.", "IT", "ECE", "EEE", "Mech", "Civil", "Other"];
const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "PG"];
const INTERESTS = ["AI / ML", "Web", "Mobile", "Cloud", "Cybersecurity", "Robotics"];

const SOCIALS = [
  { icon: Github, label: "GitHub", href: "https://github.com/" },
  { icon: Instagram, label: "Instagram", href: "https://instagram.com/" },
  { icon: Linkedin, label: "LinkedIn", href: "https://linkedin.com/" },
  { icon: MessageCircle, label: "Discord", href: "https://discord.com/" },
];

export function Join() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    branch: "",
    year: "",
    interest: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { ref, seen } = useReveal<HTMLDivElement>();

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    const { name, email, branch, year, interest } = form;
    if (!name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !branch || !year || !interest) {
      toast({
        title: "FORM PARSE ERROR",
        description: "name, email, branch, year and interest are required fields.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "join failed");
      toast({
        title: "APPLICATION QUEUED",
        description: `welcome aboard, ${name.trim()}. we ping within 48h.`,
      });
      setForm({ name: "", email: "", branch: "", year: "", interest: "", message: "" });
    } catch (err) {
      toast({
        title: "TRANSMISSION FAILED",
        description: err instanceof Error ? err.message : "unknown fault",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="join" className="relative bg-[#070b08]">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-30" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-28">
        {/* info */}
        <div ref={ref} className={`reveal ${seen ? "is-visible" : ""}`}>
          <p className="font-mono text-[11px] tracking-[0.3em] text-primary">08 / UPLINK</p>
          <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
            Join the <span className="text-glow text-primary">collective</span>
          </h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
            Applications are open all semester. Tell us what you want to
            build — we'll pair you with a team, a mentor and a deadline.
          </p>

          <div className="mt-8 space-y-3 font-mono text-xs">
            <a
              href="mailto:nexusvitc@gmail.com"
              className="flex items-center gap-3 text-muted-foreground transition-colors hover:text-primary"
            >
              <span className="grid h-9 w-9 place-items-center rounded-sm border border-border bg-card">
                <Mail className="h-4 w-4 text-primary/70" />
              </span>
              nexusvitc@gmail.com
            </a>
            <div className="flex items-center gap-3 text-muted-foreground">
              <span className="grid h-9 w-9 place-items-center rounded-sm border border-border bg-card">
                <MapPin className="h-4 w-4 text-primary/70" />
              </span>
              VIT Chennai, Kelambakkam — 600127
            </div>
          </div>

          <div className="mt-8 rounded-md border border-border bg-card/60 p-5">
            <p className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground">
              FACULTY_COORDINATORS
            </p>
            <p className="mt-2 text-sm text-foreground">Dr. S. Pavithra</p>
            <p className="text-sm text-foreground">Dr. Lekshmi K</p>
          </div>

          <div className="mt-8 flex gap-2">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="grid h-10 w-10 place-items-center rounded-sm border border-border bg-card text-muted-foreground transition-all hover:border-primary/50 hover:text-primary"
              >
                <s.icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        {/* form */}
        <div className={`reveal ${seen ? "is-visible" : ""}`} style={{ transitionDelay: "100ms" }}>
          <div className="hud-corners overflow-hidden rounded-md border border-border bg-[#050806]">
            <div className="flex items-center justify-between border-b border-border/70 bg-secondary/40 px-4 py-2.5">
              <span className="font-mono text-[11px] text-muted-foreground">nexus@vitc: ~/join</span>
              <span className="flex items-center gap-1.5 font-mono text-[9px] text-primary/70">
                <span className="led" /> FORM v2.6
              </span>
            </div>
            <div className="grid gap-4 p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="j-name" className="font-mono text-[10px] tracking-widest text-muted-foreground">
                    NAME *
                  </Label>
                  <Input
                    id="j-name"
                    value={form.name}
                    onChange={(e) => set("name")(e.target.value)}
                    placeholder="grace hopper"
                    className="border-border bg-secondary/40 font-mono text-sm"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="j-email" className="font-mono text-[10px] tracking-widest text-muted-foreground">
                    EMAIL *
                  </Label>
                  <Input
                    id="j-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email")(e.target.value)}
                    placeholder="you@vitstudent.ac.in"
                    className="border-border bg-secondary/40 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label className="font-mono text-[10px] tracking-widest text-muted-foreground">BRANCH *</Label>
                  <Select value={form.branch} onValueChange={set("branch")}>
                    <SelectTrigger className="border-border bg-secondary/40 font-mono text-sm">
                      <SelectValue placeholder="pick" />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card font-mono">
                      {BRANCHES.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="font-mono text-[10px] tracking-widest text-muted-foreground">YEAR *</Label>
                  <Select value={form.year} onValueChange={set("year")}>
                    <SelectTrigger className="border-border bg-secondary/40 font-mono text-sm">
                      <SelectValue placeholder="pick" />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card font-mono">
                      {YEARS.map((y) => (
                        <SelectItem key={y} value={y}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="font-mono text-[10px] tracking-widest text-muted-foreground">
                    INTEREST *
                  </Label>
                  <Select value={form.interest} onValueChange={set("interest")}>
                    <SelectTrigger className="border-border bg-secondary/40 font-mono text-sm">
                      <SelectValue placeholder="pick" />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card font-mono">
                      {INTERESTS.map((i) => (
                        <SelectItem key={i} value={i}>
                          {i}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="j-msg" className="font-mono text-[10px] tracking-widest text-muted-foreground">
                  WHAT DO YOU WANT TO BUILD?
                </Label>
                <Textarea
                  id="j-msg"
                  value={form.message}
                  onChange={(e) => set("message")(e.target.value)}
                  placeholder="an app that… / a rover that… / a model that…"
                  rows={4}
                  className="resize-none border-border bg-secondary/40 font-mono text-sm"
                />
              </div>

              <Button
                onClick={submit}
                disabled={submitting}
                className="mt-1 w-full font-mono text-xs font-bold tracking-widest"
              >
                {submitting ? (
                  "TRANSMITTING…"
                ) : (
                  <>
                    <Send className="mr-2 h-3.5 w-3.5" /> TRANSMIT_APPLICATION
                  </>
                )}
              </Button>
              <p className="text-center font-mono text-[9px] text-muted-foreground/60">
                NO SPAM. ONE INTERVIEW. TOTAL BEGINNERS WELCOME.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
