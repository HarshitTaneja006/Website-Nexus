import type { Metadata } from "next";
import { BootLoader } from "@/components/site/boot-loader";
import { Navbar } from "@/components/site/navbar";
import { Hero } from "@/components/site/hero";
import { ScrollFlight } from "@/components/site/scroll-flight";
import { Manifesto } from "@/components/site/manifesto";
import { EventsSection } from "@/components/site/events-section";
import { TechNews } from "@/components/site/tech-news";
import { TechStack } from "@/components/site/tech-stack";
import { AsciiGallery } from "@/components/site/ascii-gallery";
import { Team } from "@/components/site/team";
import { Join } from "@/components/site/join";
import { Footer } from "@/components/site/footer";
import { KonamiEgg } from "@/components/site/konami-egg";

const SCENE_META: Record<string, { title: string; label: string }> = {
  nexus: { title: "One City Block. One Shot.", label: "OVERWATCH" },
  gate: { title: "The Campus Grid", label: "THE GATE" },
  lab: { title: "Where Prototypes Breathe", label: "THE LAB" },
  build: { title: "36 Hours. One Shot.", label: "THE BUILD" },
  uplink: { title: "The Rooftop Frequency", label: "THE UPLINK" },
  // legacy id — four-scene flight lives on only in old share links
  community: { title: "The Rooftop Frequency", label: "THE UPLINK" },
};

/**
 * Scene-aware metadata: /?scene=build serves an OG/Twitter card that
 * unfurls with that scene's shot (rendered live by /api/og?scene=build),
 * so scene LINK chips shared on social apps preview the right frame.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ scene?: string }>;
}): Promise<Metadata> {
  const { scene } = await searchParams;
  const meta = scene ? SCENE_META[scene] : undefined;
  if (!meta) return {};
  const ogUrl = `/api/og?scene=${encodeURIComponent(scene!)}`;
  return {
    title: `${meta.title} — NEXUS Flight ${meta.label}`,
    description: `Fly the NEXUS world — ${meta.title} (${meta.label}). One continuous scroll-scrubbed shot through the collective.`,
    openGraph: {
      title: `${meta.title} — NEXUS ${meta.label}`,
      description: "One continuous scroll-scrubbed shot — your scroll is the camera throttle.",
      images: [{ url: ogUrl, width: 1200, height: 630, alt: `NEXUS flight — ${meta.label}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${meta.title} — NEXUS ${meta.label}`,
      images: [ogUrl],
    },
  };
}

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col">
      <BootLoader />
      <KonamiEgg />
      <Navbar />
      <main className="flex-1">
        <Hero />
        <ScrollFlight />
        <Manifesto />
        <EventsSection />
        <TechNews />
        <TechStack />
        <AsciiGallery />
        <Team />
        <Join />
      </main>
      <Footer />
    </div>
  );
}
