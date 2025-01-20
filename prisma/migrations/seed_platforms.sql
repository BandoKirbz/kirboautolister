-- Insert initial platforms
INSERT INTO "kirbo407"."platform" ("id", "name", "slug", "website", "createdAt", "updatedAt")
VALUES 
  ('ebay', 'eBay', 'ebay', 'https://www.ebay.com', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('grailed', 'Grailed', 'grailed', 'https://www.grailed.com', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('depop', 'Depop', 'depop', 'https://www.depop.com', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('offerup', 'OfferUp', 'offerup', 'https://www.offerup.com', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP); 