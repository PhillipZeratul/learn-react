-- 1. Drop the existing suboptimal policy entirely to ensure a clean slate
DROP POLICY IF EXISTS "Users can update their own tags" ON "public"."routine_time_tracker_tags";

-- 2. Recreate the policy with performance, security, and role optimizations
CREATE POLICY "Users can update their own tags"
ON "public"."routine_time_tracker_tags"
FOR UPDATE 
TO authenticated
USING ( (select auth.uid()) = user_id )
WITH CHECK ( (select auth.uid()) = user_id );

DROP POLICY IF EXISTS "Users can insert their own tags" ON "public"."routine_time_tracker_tags";
create policy "Users can insert their own tags" 
on "public"."routine_time_tracker_tags"
to authenticated
with check ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own tags" ON "public"."routine_time_tracker_tags";
create policy "Users can view their own tags" 
on "public"."routine_time_tracker_tags"
to authenticated
using ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own time tracker cards" ON "public"."time_tracker_cards";
create policy "Users can insert their own time tracker cards" 
on "public"."time_tracker_cards"
to authenticated
with check ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own time tracker cards" ON "public"."time_tracker_cards";
create policy "Users can update their own time tracker cards" 
on "public"."time_tracker_cards"
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own time tracker cards" ON "public"."time_tracker_cards";
create policy "Users can view their own time tracker cards" 
on "public"."time_tracker_cards"
to authenticated
using ((select auth.uid()) = user_id);