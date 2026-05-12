


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."routine_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "start_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "end_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL
);


ALTER TABLE "public"."routine_cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."routine_time_tracker_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "color" "text" DEFAULT 'Default Tag'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "is_deleted" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."routine_time_tracker_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_tracker_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "start_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "end_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL
);


ALTER TABLE "public"."time_tracker_cards" OWNER TO "postgres";


ALTER TABLE ONLY "public"."routine_cards"
    ADD CONSTRAINT "routine_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."routine_time_tracker_tags"
    ADD CONSTRAINT "routine_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_tracker_cards"
    ADD CONSTRAINT "time_tracker_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."routine_cards"
    ADD CONSTRAINT "routines_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."routine_time_tracker_tags"("id") ON UPDATE CASCADE ON DELETE SET DEFAULT;



ALTER TABLE ONLY "public"."routine_cards"
    ADD CONSTRAINT "routines_user_id_fkey1" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_tracker_cards"
    ADD CONSTRAINT "time_tracker_cards_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."routine_time_tracker_tags"("id") ON UPDATE CASCADE ON DELETE SET DEFAULT;



ALTER TABLE ONLY "public"."time_tracker_cards"
    ADD CONSTRAINT "time_tracker_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



CREATE POLICY "Users can insert their own routine cards" ON "public"."routine_cards" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own tags" ON "public"."routine_time_tracker_tags" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own time tracker cards" ON "public"."time_tracker_cards" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own routine cards" ON "public"."routine_cards" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own tags" ON "public"."routine_time_tracker_tags" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own time tracker cards" ON "public"."time_tracker_cards" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own routine cards" ON "public"."routine_cards" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own tags" ON "public"."routine_time_tracker_tags" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own time tracker cards" ON "public"."time_tracker_cards" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."routine_cards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."routine_time_tracker_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."time_tracker_cards" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."routine_cards";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."routine_time_tracker_tags";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."time_tracker_cards";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";
























GRANT ALL ON TABLE "public"."routine_cards" TO "anon";
GRANT ALL ON TABLE "public"."routine_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."routine_cards" TO "service_role";



GRANT ALL ON TABLE "public"."routine_time_tracker_tags" TO "anon";
GRANT ALL ON TABLE "public"."routine_time_tracker_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."routine_time_tracker_tags" TO "service_role";



GRANT ALL ON TABLE "public"."time_tracker_cards" TO "anon";
GRANT ALL ON TABLE "public"."time_tracker_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."time_tracker_cards" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































drop extension if exists "pg_net";


