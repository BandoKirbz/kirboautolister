import { CheckCircle, Clock, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type PlatformStatusItem = {
  id: string;
  name: string;
  logo?: string;
  connected: boolean;
  availability: "available" | "coming_soon";
  username?: string | null;
};

interface PlatformStatusProps {
  platforms: PlatformStatusItem[];
}

export function PlatformStatus({ platforms }: PlatformStatusProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {platforms.map((platform) => {
            const isComingSoon = platform.availability === "coming_soon";
            const label = isComingSoon
              ? "Coming soon"
              : platform.connected
                ? "Connected"
                : "Not connected";

            return (
              <div
                key={platform.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex h-8 w-8 items-center justify-center text-xl">
                    {platform.logo || "•"}
                  </div>
                  <div>
                    <p className="font-medium">{platform.name}</p>
                    {platform.connected && platform.username && (
                      <p className="text-xs text-muted-foreground">@{platform.username}</p>
                    )}
                    <Badge
                      variant="secondary"
                      className={
                        isComingSoon
                          ? "mt-1 bg-slate-100 text-slate-700"
                          : platform.connected
                            ? "mt-1 bg-green-100 text-green-800"
                            : "mt-1 bg-amber-100 text-amber-800"
                      }
                    >
                      {isComingSoon ? (
                        <Clock className="mr-1 h-3 w-3" />
                      ) : platform.connected ? (
                        <CheckCircle className="mr-1 h-3 w-3" />
                      ) : (
                        <XCircle className="mr-1 h-3 w-3" />
                      )}
                      {label}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
