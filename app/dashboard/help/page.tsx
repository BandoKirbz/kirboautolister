import { Metadata } from "next";
import Link from "next/link";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Help",
  description: "Frequently asked questions and support",
};

const faqs = [
  {
    q: "How do I list a product on eBay?",
    a: (
      <>
        Go to{" "}
        <Link href="/dashboard/platforms" className="underline">
          Platforms
        </Link>{" "}
        and connect your eBay account first (you'll sign in on eBay's site). Once connected,
        create or edit a product from{" "}
        <Link href="/dashboard/add-product" className="underline">
          Add Product
        </Link>{" "}
        and check the eBay box before saving. If eBay isn't connected yet, its checkbox will
        be disabled.
      </>
    ),
  },
  {
    q: "Why is a platform other than eBay greyed out?",
    a: "Only eBay is live right now. Other marketplaces (Grailed, Depop, OfferUp) are shown so you can see what's planned, but they're marked \"Coming soon\" and can't be connected or used to publish listings yet.",
  },
  {
    q: "My listing shows an \"Error\" status - what do I do?",
    a: (
      <>
        Click the listing (or open it from{" "}
        <Link href="/dashboard/listings" className="underline">
          Listings
        </Link>
        ) to see the specific error message, then edit and re-save the product from{" "}
        <Link href="/dashboard/add-product" className="underline">
          Add Product
        </Link>
        . Common causes are missing required fields (brand, condition) or eBay account setup
        (business policies, opted-in programs) not finished on eBay's side.
      </>
    ),
  },
  {
    q: "How do I see a listing on eBay itself?",
    a: (
      <>
        On the{" "}
        <Link href="/dashboard/listings" className="underline">
          Listings
        </Link>{" "}
        page (or from a product card), listings that are actually live show an external-link
        icon/badge - click it to open the real eBay listing page in a new tab.
      </>
    ),
  },
  {
    q: "What happens if I delete a product or uncheck a platform?",
    a: "Deleting a product, unchecking a platform for it, or converting it back to a draft will end the corresponding live listing on that platform - it doesn't just stop tracking it locally and leave it live. You'll be asked to confirm before anything destructive happens.",
  },
  {
    q: "Can I change my email, username, or password?",
    a: (
      <>
        Yes - all of that is on the{" "}
        <Link href="/dashboard/settings" className="underline">
          Settings
        </Link>{" "}
        page.
      </>
    ),
  },
  {
    q: "Is this app free to use?",
    a: (
      <>
        Yes, for now - see{" "}
        <Link href="/dashboard/billing" className="underline">
          Billing
        </Link>{" "}
        for details.
      </>
    ),
  },
];

export default function HelpPage() {
  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Help</h2>
        <p className="text-muted-foreground">Answers to common questions</p>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Frequently asked questions</CardTitle>
          <CardDescription>
            Can't find what you're looking for? Reach out and we'll help you sort it out.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible>
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
