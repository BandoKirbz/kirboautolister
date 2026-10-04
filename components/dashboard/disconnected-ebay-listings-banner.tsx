import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** Shown when local eBay listing rows exist but OAuth tokens do not. */
export function DisconnectedEbayListingsBanner() {
  return (
    <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50">
      <AlertTitle>eBay listings are still here — the account is not connected</AlertTitle>
      <AlertDescription>
        Kirbo keeps a local copy of listings you already published. Disconnecting only removes this
        app&apos;s OAuth tokens, so those rows (and the live eBay items) stay visible. Revisions and
        withdrawals will fail until you{" "}
        <Link href="/dashboard/platforms" className="font-medium underline">
          reconnect eBay
        </Link>
        .
      </AlertDescription>
    </Alert>
  );
}
