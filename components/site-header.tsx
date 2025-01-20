"use client";

import * as React from "react";

import { useSession } from "next-auth/react";
import Link from "next/link";

import { Package } from "lucide-react";

import { UserNav } from "@/components/pages/dashboard/user-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { data: session, status } = useSession();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href={session ? "/dashboard" : "/"} className="flex items-center">
          <Package className="h-8 w-8 text-primary" />
          <span className="ml-2 text-xl font-bold">Kirbo Autolister</span>
        </Link>
        <div className="flex items-center gap-4">
          {status === "loading" ? null : session?.user ? (
            <UserNav user={session.user} />
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Log In
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Sign Up</Button>
              </Link>
            </>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
