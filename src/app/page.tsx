import fs from "fs";
import path from "path";
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

export default function Page() {
  // decides at SSR whether the blob-scrubbed fly-in clip exists
  let hasIntroVideo = false;
  try {
    const videoPath = path.join(process.cwd(), "public", "media", "hero-flight.mp4");
    hasIntroVideo = fs.existsSync(videoPath) && fs.statSync(videoPath).size > 10000;
  } catch {
    hasIntroVideo = false;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <BootLoader />
      <Navbar />
      <main className="flex-1">
        <Hero />
        <ScrollFlight hasIntroVideo={hasIntroVideo} />
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
