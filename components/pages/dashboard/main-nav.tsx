import Link from "next/link";

import { cn } from "@/lib/utils";

export function MainNav({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <nav className={cn("flex items-center space-x-6", className)} {...props}>
      <Link href="/dashboard" className="text-xl font-bold transition-colors hover:text-primary">
        Kirbo Autolister
      </Link>
    </nav>
  );
}
