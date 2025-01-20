import { formatDistanceToNow } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ActivityFeedProps {
  listings: {
    id: string;
    status: string;
    updatedAt: Date;
    platform: {
      name: string;
    };
  }[];
}

const statusColors = {
  DRAFT: "text-gray-500",
  PENDING: "text-yellow-500",
  ACTIVE: "text-green-500",
  PAUSED: "text-orange-500",
  ENDED: "text-red-500",
  ERROR: "text-red-500",
};

const statusMessages = {
  DRAFT: "saved as draft",
  PENDING: "pending review",
  ACTIVE: "listed successfully",
  PAUSED: "paused",
  ENDED: "ended",
  ERROR: "failed to list",
};

export function ActivityFeed({ listings }: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {listings.map((listing) => (
            <div key={listing.id} className="flex items-start space-x-4">
              <div className="relative mt-0.5">
                <span
                  className={`absolute flex h-3 w-3 ${
                    statusColors[listing.status as keyof typeof statusColors]
                  }`}
                >
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full" />
                </span>
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">{listing.platform.name}</p>
                <p className="text-sm text-muted-foreground">
                  Listing {statusMessages[listing.status as keyof typeof statusMessages]}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(listing.updatedAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}

          {listings.length === 0 && (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              No recent activity
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
