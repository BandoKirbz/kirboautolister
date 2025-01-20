import React from "react";

import Link from "next/link";

import { ArrowRight, Globe, LineChart, Package, Zap } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

function BackgroundGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(rgba(255, 255, 255, .1) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(255, 255, 255, .1) 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
          opacity: 0.2,
        }}
      />
    </div>
  );
}

export default function Home() {
  const features = [
    {
      icon: <Package className="h-10 w-10 text-blue-500" />,
      title: "Unified Product Management",
      description: "Manage all your listings in one place, no more switching between platforms",
    },
    {
      icon: <Globe className="h-10 w-10 text-blue-500" />,
      title: "Multi-Platform Sync",
      description: "List on eBay, Grailed, Depop, and more with a single click",
    },
    {
      icon: <Zap className="h-10 w-10 text-blue-500" />,
      title: "Automatic Optimization",
      description: "Platform-specific optimizations for maximum visibility",
    },
    {
      icon: <LineChart className="h-10 w-10 text-blue-500" />,
      title: "Analytics & Insights",
      description: "Track performance across all platforms in real-time",
    },
  ];

  return (
    <>
      <SiteHeader />
      <div className="relative min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
        {/* Background patterns */}
        <div className="bg-grid absolute inset-0" />

        {/* Hero Section */}
        <main className="relative z-10 pb-16 pt-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="space-y-8 text-center">
              <h1 className="gradient-text text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl">
                Automate Your Reselling Business
              </h1>
              <p className="mx-auto max-w-2xl text-xl text-gray-600 dark:text-gray-300">
                List your products across multiple platforms with ease. Save time, increase sales,
                and grow your business with Kirbo Autolister.
              </p>

              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <Link href="/register">
                  <Button
                    size="lg"
                    className="bg-primary px-8 text-primary-foreground hover:bg-primary/90"
                  >
                    Get Started
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/demo">
                  <Button size="lg" variant="outline" className="px-8">
                    Watch Demo
                  </Button>
                </Link>
              </div>

              {/* Stats */}
              <div className="glass-morphism mx-auto mt-16 grid max-w-2xl grid-cols-3 gap-8 rounded-2xl p-8">
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary">10K+</div>
                  <div className="mt-1 text-sm text-muted-foreground">Active Users</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary">500K+</div>
                  <div className="mt-1 text-sm text-muted-foreground">Products Listed</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary">5+</div>
                  <div className="mt-1 text-sm text-muted-foreground">Platforms</div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Features Section */}
        <section className="relative z-10 py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="gradient-text mb-16 text-center text-3xl font-bold sm:text-4xl">
              Everything you need to scale your reselling business
            </h2>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature, index) => (
                <div key={index} className="hover-card glass-morphism rounded-2xl p-8">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="rounded-xl bg-primary/10 p-3">{feature.icon}</div>
                    <h3 className="text-lg font-semibold">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative z-10 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="glass-morphism rounded-3xl px-6 py-16 sm:px-16 sm:py-24">
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="gradient-text mb-6 text-3xl font-bold sm:text-4xl">
                  Ready to boost your sales?
                </h2>
                <p className="mb-10 text-lg text-muted-foreground">
                  Join thousands of successful resellers who have transformed their business with
                  Kirbo Autolister.
                </p>
                <Link href="/register">
                  <Button
                    size="lg"
                    className="bg-primary px-8 text-primary-foreground hover:bg-primary/90"
                  >
                    Start Free Trial
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
