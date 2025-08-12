ALTER TABLE "index_cards" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "indexes" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();