"use client";

import { useMemo, useState } from "react";

import Image from "next/image";
import Link from "next/link";

import { ExternalLink, Pencil } from "lucide-react";

import { getPlatformDefinition } from "@/lib/platforms";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ListingStatus = "DRAFT" | "PENDING" | "ACTIVE" | "PAUSED" | "ENDED" | "ERROR";

interface ListingRow {
  id: string;
  price: number;
  status: ListingStatus;
  errors?: string | null;
  updatedAt: string | Date;
  platformListingId?: string | null;
  listingUrl?: string | null;
  platform: { id: string; name: string };
  product: {
    id: string;
    name: string;
    images: { url: string }[];
  };
}

const statusColor: Record<ListingStatus, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  PENDING: "bg-orange-100 text-orange-800",
  DRAFT: "bg-yellow-100 text-yellow-800",
  PAUSED: "bg-slate-100 text-slate-700",
  ENDED: "bg-slate-100 text-slate-700",
  ERROR: "bg-red-100 text-red-800",
};

function isLocalOrDataUrl(url: string): boolean {
  return url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("/");
}

export function ListingsTable({ listings }: { listings: ListingRow[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");

  const platformOptions = useMemo(() => {
    const seen = new Map<string, string>();
    listings.forEach((l) => seen.set(l.platform.id, l.platform.name));
    return Array.from(seen.entries());
  }, [listings]);

  const filtered = listings.filter((listing) => {
    const matchesSearch = listing.product.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || listing.status === statusFilter;
    const matchesPlatform = platformFilter === "all" || listing.platform.id === platformFilter;
    return matchesSearch && matchesStatus && matchesPlatform;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by product name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-[300px]"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="PAUSED">Paused</SelectItem>
            <SelectItem value="ENDED">Ended</SelectItem>
            <SelectItem value="ERROR">Error</SelectItem>
          </SelectContent>
        </Select>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            {platformOptions.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              {listings.length === 0
                ? "No listings yet - add a product and select a platform to publish it."
                : "No listings match your filters."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Platform</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Last updated</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((listing) => {
                    const platformDef = getPlatformDefinition(listing.platform.id);
                    const imageUrl = listing.product.images[0]?.url;
                    return (
                      <tr key={listing.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {imageUrl ? (
                              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded border">
                                <Image
                                  src={imageUrl}
                                  alt={listing.product.name}
                                  fill
                                  unoptimized={isLocalOrDataUrl(imageUrl)}
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <div className="h-10 w-10 shrink-0 rounded border bg-muted" />
                            )}
                            <span className="line-clamp-1 font-medium">{listing.product.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1">
                            {platformDef?.logo} {listing.platform.name}
                          </span>
                        </td>
                        <td className="px-4 py-3">${listing.price.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="secondary"
                            className={statusColor[listing.status]}
                            title={listing.status === "ERROR" ? listing.errors || undefined : undefined}
                          >
                            {listing.status}
                          </Badge>
                          {listing.status === "ERROR" && listing.errors && (
                            <p className="mt-1 line-clamp-1 max-w-[220px] text-xs text-red-600">
                              {listing.errors}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {/* Explicit locale/timezone to avoid a server/client
                              hydration mismatch - see settings-form.tsx. */}
                          {new Date(listing.updatedAt).toLocaleDateString("en-US", {
                            timeZone: "UTC",
                          })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {listing.listingUrl && (
                              <Button asChild variant="ghost" size="icon" title={`View live on ${listing.platform.name}`}>
                                <a href={listing.listingUrl} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            <Button asChild variant="ghost" size="icon" title="Edit product">
                              <Link href={`/dashboard/add-product?edit=${listing.product.id}`}>
                                <Pencil className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
