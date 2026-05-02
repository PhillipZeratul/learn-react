DROP POLICY IF EXISTS "Users can insert their own tags" ON "public"."routine_time_tracker_tags";
create policy "Users can insert their own tags" 
on "public"."routine_time_tracker_tags"
for insert
to authenticated
with check ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own tags" ON "public"."routine_time_tracker_tags";
create policy "Users can view their own tags" 
on "public"."routine_time_tracker_tags"
for select
to authenticated
using ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own time tracker cards" ON "public"."time_tracker_cards";
create policy "Users can insert their own time tracker cards" 
on "public"."time_tracker_cards"
for insert
to authenticated
with check ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own time tracker cards" ON "public"."time_tracker_cards";
create policy "Users can update their own time tracker cards" 
on "public"."time_tracker_cards"
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own time tracker cards" ON "public"."time_tracker_cards";
create policy "Users can view their own time tracker cards" 
on "public"."time_tracker_cards"
for select
to authenticated
using ((select auth.uid()) = user_id);