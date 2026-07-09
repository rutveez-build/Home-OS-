CREATE TABLE "household_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"minted_by_user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "household_tokens" ADD CONSTRAINT "household_tokens_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_tokens" ADD CONSTRAINT "household_tokens_minted_by_user_id_users_id_fk" FOREIGN KEY ("minted_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "household_tokens_family_idx" ON "household_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "household_tokens_hash_unique" ON "household_tokens" USING btree ("token_hash");