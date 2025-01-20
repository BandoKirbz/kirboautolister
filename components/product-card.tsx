"use client";

import { useState } from "react";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Trash } from "lucide-react";

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

export function ProductCard({ product }: ProductCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const status =
    statusConfig[product.listings[0]?.status as keyof typeof statusConfig] || statusConfig.DRAFT;
  const price = product.price;

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation
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
    <Link href={`/dashboard/add-product?edit=${product.id}`}>
      <Card className="group overflow-hidden transition-all hover:shadow-md">
        <CardHeader className="p-0">
          <div className="aspect-square overflow-hidden">
            <div className="relative h-48 w-full">
              <Image
                src={product.images[0]?.url || "/placeholder-image.jpg"}
                alt={product.name}
                fill
                className="object-contain transition-transform group-hover:scale-105"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <Badge variant="secondary" className={status.color}>
              {status.label}
            </Badge>
            <span className="font-semibold">${price.toFixed(2)}</span>
          </div>
          <h3 className="line-clamp-2 font-medium">{product.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Condition: {product.condition.replace(/-/g, " ")}
          </p>
        </CardContent>
        <CardFooter className="p-4 pt-0">
          <div className="flex flex-wrap gap-1">
            {product.listings.map((listing) => (
              <Badge key={listing.platform.id} variant="outline" className="text-xs">
                {listing.platform.name}
              </Badge>
            ))}
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
