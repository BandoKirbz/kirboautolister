import { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/app/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Billing",
  description: "View your current plan and billing status",
};

const statusColor: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  TRIALING: "bg-blue-100 text-blue-800",
  PAST_DUE: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-red-100 text-red-800",
  INACTIVE: "bg-slate-100 text-slate-700",
};

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const subscription = await db.subscriptionstatus.findUnique({
    where: { userId: session.user.id },
    include: { plan: true },
  });

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Billing</h2>
        <p className="text-muted-foreground">Your current plan and billing status</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{subscription?.plan.name ?? "Free plan"}</CardTitle>
              <CardDescription>
                {subscription
                  ? subscription.plan.description
                  : "You're not currently on a paid plan."}
              </CardDescription>
            </div>
            <Badge
              variant="secondary"
              className={statusColor[subscription?.status ?? "INACTIVE"]}
            >
              {subscription?.status ?? "No paid plan"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {subscription ? (
            <div className="grid gap-2 text-muted-foreground">
              <p>
                Price: ${subscription.plan.price.toFixed(2)} /{" "}
                {subscription.plan.interval.toLowerCase()}
              </p>
              {subscription.startDate && (
                <p>
                  Started:{" "}
                  {new Date(subscription.startDate).toLocaleDateString("en-US", {
                    timeZone: "UTC",
                  })}
                </p>
              )}
              {subscription.endDate && (
                <p>
                  Renews / ends:{" "}
                  {new Date(subscription.endDate).toLocaleDateString("en-US", {
                    timeZone: "UTC",
                  })}
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">
              All core features - unlimited products, eBay listing sync, and platform
              management - are free while Kirbo Autolister is in early access. Paid plans
              with additional platforms and higher limits aren't available yet; we'll notify
              you here when they are.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
