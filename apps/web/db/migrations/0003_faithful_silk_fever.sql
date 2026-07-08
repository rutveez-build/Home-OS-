CREATE TABLE "meal_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"plan_id" uuid,
	"user_id" uuid,
	"dish" text NOT NULL,
	"meal" text NOT NULL,
	"cooked" text NOT NULL,
	"verdict" text,
	"leftovers" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meal_feedback" ADD CONSTRAINT "meal_feedback_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_feedback" ADD CONSTRAINT "meal_feedback_plan_id_meal_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_feedback" ADD CONSTRAINT "meal_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meal_feedback_family_idx" ON "meal_feedback" USING btree ("family_id");