import type { Metadata } from "next";
import { BootLoader } from "@/components/site/boot-loader";
import { Navbar } from "@/components/site/navbar";
import { Hero } from "@/components/site/hero";
import { GlyphForge } from "@/components/site/glyph-forge";
import { Manifesto } from "@/components/site/manifesto";
import { EventsSection } from "@/components/site/events-section";
import { TechNews } from "@/components/site/tech-news";
import { TechStack } from "@/components/site/tech-stack";
import { AsciiGallery } from "@/components/site/ascii-gallery";
import { Team } from "@/components/site/team";
import { Join } from "@/components/site/join";
import { Footer } from "@/components/site/footer";
import { KonamiEgg } from "@/components/site/konami-egg";

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col">
      <BootLoader />
      <KonamiEgg />
      <Navbar />
      <main className="flex-1">
        <Hero />
        <GlyphForge />
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

export const metadata: Metadata = {
  title: "NEXUS - Student Tech Collective, VIT Chennai",
  description:
    "Innovate. Lead. Build. The terminal-grade home of NEXUS - live ASCII engines, the glyph foundry, events, news and more.",
  openGraph: {
    title: "NEXUS - Student Tech Collective, VIT Chennai",
    description: "Innovate. Lead. Build. Live ASCII engines, events and a community of builders.",
    images: [{ url: "/api/og", width: 1200, height: 630, alt: "NEXUS - Student Tech Collective" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "NEXUS - Student Tech Collective, VIT Chennai",
    images: ["/api/og"],
  },
};
