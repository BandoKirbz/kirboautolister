"use client";

import { useState } from "react";

import Image from "next/image";
import { useRouter } from "next/navigation";

import { ExternalLink, Trash } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type ListingStatus = "ACTIVE" | "SOLD" | "DRAFT" | "PENDING" | "ERROR" | "PAUSED";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    images: {
      id: string;
      url: string;
      order: number;
      productId: string;
    }[];
    condition: string;
    listings: {
      id: string;
      status: ListingStatus;
      price: number;
      platformListingId?: string | null;
      listingUrl?: string | null;
      errors?: string | null;
      platform: {
        id: string;
        name: string;
      };
    }[];
  };
}

const statusConfig = {
  ACTIVE: { label: "Active", color: "bg-green-500" },
  SOLD: { label: "Sold", color: "bg-blue-500" },
  DRAFT: { label: "Draft", color: "bg-yellow-500" },
  PENDING: { label: "Pending", color: "bg-orange-500" },
  ERROR: { label: "Error", color: "bg-red-500" },
};

function resolvePrice(price: number | string): number {
  if (typeof price === "number") return price;
  const parsed = parseFloat(String(price).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isLocalOrDataUrl(url: string): boolean {
  return (
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    url.startsWith("/")
  );
}

export function ProductCard({ product }: ProductCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const primaryListing = product.listings[0];
  const status = statusConfig[primaryListing?.status as keyof typeof statusConfig] || statusConfig.DRAFT;
  const errorDetail = primaryListing?.status === "ERROR" ? primaryListing.errors : null;
  const price = resolvePrice(product.price as number | string);
  const imageUrl = product.images[0]?.url || "/placeholder-image.jpg";
  const useUnoptimizedImage = isLocalOrDataUrl(imageUrl);

  const handleDelete = async () => {
    if (isDeleting) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/products/${product.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete product");
      }

      toast({
        title: "Success",
        description: "Product deleted successfully",
      });
      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/dashboard/add-product?edit=${product.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/dashboard/add-product?edit=${product.id}`);
      }}
      className="group cursor-pointer overflow-hidden transition-all hover:shadow-md"
    >
      <CardHeader className="p-0">
        <div className="aspect-square overflow-hidden">
          <div className="relative h-48 w-full">
            <Image
              src={imageUrl}
              alt={product.name}
              fill
              unoptimized={useUnoptimizedImage}
              className="object-contain transition-transform group-hover:scale-105"
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()} // Don't trigger the card's navigate-to-edit click
                  disabled={isDeleting}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete "{product.name}"?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes the product from your dashboard.
                    {product.listings.some((l) => l.platform.id === "ebay") && (
                      <>
                        {" "}
                        It will also <strong>end the live eBay listing</strong> for this item
                        (if one exists) - this can't be undone.
                      </>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <Badge
            variant="secondary"
            className={status.color}
            title={errorDetail ? `eBay sync error: ${errorDetail}` : undefined}
          >
            {status.label}
          </Badge>
          <span className="font-semibold">${price.toFixed(2)}</span>
        </div>
        <h3 className="line-clamp-2 font-medium">{product.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Condition: {product.condition.replace(/-/g, " ")}
        </p>
        {errorDetail && (
          <p className="mt-1 line-clamp-2 text-xs text-red-600" title={errorDetail}>
            {errorDetail} - click to edit and retry.
          </p>
        )}
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <div className="flex flex-wrap gap-1">
          {product.listings.map((listing) =>
            listing.listingUrl ? (
              <a
                key={listing.id}
                href={listing.listingUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={`View live on ${listing.platform.name}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-full border border-input bg-background px-2.5 py-0.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {listing.platform.name}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <Badge key={listing.id} variant="outline" className="text-xs">
                {listing.platform.name}
              </Badge>
            )
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
