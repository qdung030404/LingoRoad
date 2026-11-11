import React from 'react';
import { Navbar } from '@/components/landing/Navbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { StatsSection } from '@/components/landing/StatsSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { AdaptiveSimulator } from '@/components/landing/AdaptiveSimulator';
import { MethodologySection } from '@/components/landing/MethodologySection';
import { ComparisonSection } from '@/components/landing/ComparisonSection';
import { FaqSection } from '@/components/landing/FaqSection';
import { CtaBanner } from '@/components/landing/CtaBanner';
import { Footer } from '@/components/landing/Footer';

export default function LandingPage(): React.ReactElement {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />
      <main className="flex-grow">
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <AdaptiveSimulator />
        <MethodologySection />
        <ComparisonSection />
        <FaqSection />
        <CtaBanner />
      </main>
      <Footer />
    </div>
  );
}
