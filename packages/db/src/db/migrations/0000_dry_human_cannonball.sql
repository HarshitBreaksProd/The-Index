CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TYPE "public"."card_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."card_type" AS ENUM('text', 'url', 'pdf', 'youtube', 'spotify', 'tweet');--> statement-breakpoint
CREATE TABLE "cards_to_tags" (
	"card_id" uuid NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "cards_to_tags_card_id_tag_id_pk" PRIMARY KEY("card_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "index_cards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"index_id" uuid NOT NULL,
	"user_id" integer NOT NULL,
	"type" "card_type" NOT NULL,
	"source" text NOT NULL,
	"title" varchar(255) NOT NULL,
	"status" "card_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"storage_url" text,
	"embedding" vector(384),
	"is_shareable" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indexes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"cover_image_url" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"shareable_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "indexes_shareable_id_unique" UNIQUE("shareable_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "cards_to_tags" ADD CONSTRAINT "cards_to_tags_card_id_index_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."index_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards_to_tags" ADD CONSTRAINT "cards_to_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "index_cards" ADD CONSTRAINT "index_cards_index_id_indexes_id_fk" FOREIGN KEY ("index_id") REFERENCES "public"."indexes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "index_cards" ADD CONSTRAINT "index_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indexes" ADD CONSTRAINT "indexes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;