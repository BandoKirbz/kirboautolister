import { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/app/auth";
import { SettingsForm } from "@/components/forms/settings-form";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your profile and account settings",
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const profile = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      bio: true,
      username: true,
      location: true,
      website: true,
      businessName: true,
      taxId: true,
      createdAt: true,
    },
  });

  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Manage your profile, account, and security</p>
      </div>

      <SettingsForm profile={profile} />
    </div>
  );
}
