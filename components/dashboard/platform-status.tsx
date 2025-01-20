import { CheckCircle, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PlatformStatusProps {
  platforms: {
    isEnabled: boolean;
    platform: {
      id: string;
      name: string;
      logoUrl?: string | null;
    };
  }[];
}

const platformColors = {
  ebay: "bg-red-100 text-red-800",
  grailed: "bg-blue-100 text-blue-800",
  depop: "bg-green-100 text-green-800",
  offerup: "bg-purple-100 text-purple-800",
};

export function PlatformStatus({ platforms }: PlatformStatusProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {platforms.map((connection) => (
            <div
              key={connection.platform.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center space-x-4">
                <div className="flex h-8 w-8 items-center justify-center">
                  {connection.platform.logoUrl ? (
                    <img
                      src={connection.platform.logoUrl}
                      alt={connection.platform.name}
                      className="h-6 w-6"
                    />
                  ) : (
                    <span className="text-xl">
                      {connection.platform.name === "eBay" && "📦"}
                      {connection.platform.name === "Grailed" && "👕"}
                      {connection.platform.name === "Depop" && "🛍️"}
                      {connection.platform.name === "OfferUp" && "🏷️"}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-medium">{connection.platform.name}</p>
                  <Badge
                    variant="secondary"
                    className={
                      platformColors[connection.platform.id as keyof typeof platformColors]
                    }
                  >
                    {connection.isEnabled ? (
                      <CheckCircle className="mr-1 h-3 w-3" />
                    ) : (
                      <XCircle className="mr-1 h-3 w-3" />
                    )}
                    {connection.isEnabled ? "Connected" : "Disconnected"}
                  </Badge>
                </div>
              </div>
            </div>
          ))}

          {platforms.length === 0 && (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              No platforms connected yet
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
