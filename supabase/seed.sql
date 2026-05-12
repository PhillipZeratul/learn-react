SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict wJsj6IdH8jtNUMHhukOWtrOIDwcTnPWtbWNmwGKugtu2XcPFdYDthBszSbeVUg9

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', '4960388d-ff06-4669-9573-8b093b8fc3c7', 'authenticated', 'authenticated', 'p.f.zeratul@gmail.com', '$2a$10$nByycCCVhHunuPbpZMTpTe61dGteD5Ae.iYa2r7nZnkIzKTj5k/6a', '2026-04-14 05:55:40.903456+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-04-14 06:15:49.5944+00', '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', NULL, '2026-04-14 05:55:40.866374+00', '2026-04-23 09:14:29.684255+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
	('4960388d-ff06-4669-9573-8b093b8fc3c7', '4960388d-ff06-4669-9573-8b093b8fc3c7', '{"sub": "4960388d-ff06-4669-9573-8b093b8fc3c7", "email": "p.f.zeratul@gmail.com", "email_verified": false, "phone_verified": false}', 'email', '2026-04-14 05:55:40.893576+00', '2026-04-14 05:55:40.893631+00', '2026-04-14 05:55:40.893631+00', '2d654543-87fd-49f3-83c2-4f614e8940cd');


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag", "oauth_client_id", "refresh_token_hmac_key", "refresh_token_counter", "scopes") VALUES
	('d6672140-f5a4-4172-8014-d6bacf9b246b', '4960388d-ff06-4669-9573-8b093b8fc3c7', '2026-04-14 06:15:49.594507+00', '2026-04-23 09:14:29.697572+00', NULL, 'aal1', NULL, '2026-04-23 09:14:29.697446', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36', '185.36.192.7', NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") VALUES
	('d6672140-f5a4-4172-8014-d6bacf9b246b', '2026-04-14 06:15:49.637963+00', '2026-04-14 06:15:49.637963+00', 'password', '24597dfa-5a78-42e3-9297-b44496ffb551');


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") VALUES
	('00000000-0000-0000-0000-000000000000', 1, '6kqzj3m7mcwq', '4960388d-ff06-4669-9573-8b093b8fc3c7', true, '2026-04-14 06:15:49.622955+00', '2026-04-17 05:05:11.123026+00', NULL, 'd6672140-f5a4-4172-8014-d6bacf9b246b'),
	('00000000-0000-0000-0000-000000000000', 2, 'zr662ggc6oqv', '4960388d-ff06-4669-9573-8b093b8fc3c7', true, '2026-04-17 05:05:11.143452+00', '2026-04-17 07:47:16.759247+00', '6kqzj3m7mcwq', 'd6672140-f5a4-4172-8014-d6bacf9b246b'),
	('00000000-0000-0000-0000-000000000000', 3, '3hgaiulttmvq', '4960388d-ff06-4669-9573-8b093b8fc3c7', true, '2026-04-17 07:47:16.772805+00', '2026-04-17 09:11:29.024307+00', 'zr662ggc6oqv', 'd6672140-f5a4-4172-8014-d6bacf9b246b'),
	('00000000-0000-0000-0000-000000000000', 4, 'jylyv6uv3vhd', '4960388d-ff06-4669-9573-8b093b8fc3c7', true, '2026-04-17 09:11:29.032655+00', '2026-04-17 10:15:25.568362+00', '3hgaiulttmvq', 'd6672140-f5a4-4172-8014-d6bacf9b246b'),
	('00000000-0000-0000-0000-000000000000', 5, 'ufcwrusqh252', '4960388d-ff06-4669-9573-8b093b8fc3c7', true, '2026-04-17 10:15:25.578259+00', '2026-04-18 05:16:39.857753+00', 'jylyv6uv3vhd', 'd6672140-f5a4-4172-8014-d6bacf9b246b'),
	('00000000-0000-0000-0000-000000000000', 6, 'uyis5pp35izo', '4960388d-ff06-4669-9573-8b093b8fc3c7', true, '2026-04-18 05:16:39.869399+00', '2026-04-18 09:43:46.185163+00', 'ufcwrusqh252', 'd6672140-f5a4-4172-8014-d6bacf9b246b'),
	('00000000-0000-0000-0000-000000000000', 7, 'ta7t2rnz36l6', '4960388d-ff06-4669-9573-8b093b8fc3c7', true, '2026-04-18 09:43:46.202672+00', '2026-04-18 10:41:57.807784+00', 'uyis5pp35izo', 'd6672140-f5a4-4172-8014-d6bacf9b246b'),
	('00000000-0000-0000-0000-000000000000', 8, '47fenwvmieuz', '4960388d-ff06-4669-9573-8b093b8fc3c7', true, '2026-04-18 10:41:57.820388+00', '2026-04-19 01:42:47.240411+00', 'ta7t2rnz36l6', 'd6672140-f5a4-4172-8014-d6bacf9b246b'),
	('00000000-0000-0000-0000-000000000000', 9, 'mwxvzsrggvfa', '4960388d-ff06-4669-9573-8b093b8fc3c7', true, '2026-04-19 01:42:47.257299+00', '2026-04-19 02:47:48.717754+00', '47fenwvmieuz', 'd6672140-f5a4-4172-8014-d6bacf9b246b'),
	('00000000-0000-0000-0000-000000000000', 10, 'j5v4jdegeolr', '4960388d-ff06-4669-9573-8b093b8fc3c7', true, '2026-04-19 02:47:48.731334+00', '2026-04-19 03:46:12.669019+00', 'mwxvzsrggvfa', 'd6672140-f5a4-4172-8014-d6bacf9b246b'),
	('00000000-0000-0000-0000-000000000000', 11, 'yaltxzk2a6ot', '4960388d-ff06-4669-9573-8b093b8fc3c7', true, '2026-04-19 03:46:12.682847+00', '2026-04-19 04:44:41.110336+00', 'j5v4jdegeolr', 'd6672140-f5a4-4172-8014-d6bacf9b246b'),
	('00000000-0000-0000-0000-000000000000', 12, '36d77p5vf6of', '4960388d-ff06-4669-9573-8b093b8fc3c7', true, '2026-04-19 04:44:41.121264+00', '2026-04-20 02:28:41.422879+00', 'yaltxzk2a6ot', 'd6672140-f5a4-4172-8014-d6bacf9b246b'),
	('00000000-0000-0000-0000-000000000000', 13, 'ihnvavrahab6', '4960388d-ff06-4669-9573-8b093b8fc3c7', true, '2026-04-20 02:28:41.441602+00', '2026-04-20 03:27:06.982571+00', '36d77p5vf6of', 'd6672140-f5a4-4172-8014-d6bacf9b246b'),
	('00000000-0000-0000-0000-000000000000', 14, 'zblvf62ddsio', '4960388d-ff06-4669-9573-8b093b8fc3c7', true, '2026-04-20 03:27:06.99357+00', '2026-04-21 01:34:12.442922+00', 'ihnvavrahab6', 'd6672140-f5a4-4172-8014-d6bacf9b246b'),
	('00000000-0000-0000-0000-000000000000', 15, '4fz7db637bjv', '4960388d-ff06-4669-9573-8b093b8fc3c7', true, '2026-04-21 01:34:12.452773+00', '2026-04-21 02:32:55.169282+00', 'zblvf62ddsio', 'd6672140-f5a4-4172-8014-d6bacf9b246b'),
	('00000000-0000-0000-0000-000000000000', 16, '3gmhibvyovlb', '4960388d-ff06-4669-9573-8b093b8fc3c7', true, '2026-04-21 02:32:55.183596+00', '2026-04-21 03:31:20.281423+00', '4fz7db637bjv', 'd6672140-f5a4-4172-8014-d6bacf9b246b'),
	('00000000-0000-0000-0000-000000000000', 17, 'qcmie375kquw', '4960388d-ff06-4669-9573-8b093b8fc3c7', true, '2026-04-21 03:31:20.291996+00', '2026-04-21 04:29:39.629723+00', '3gmhibvyovlb', 'd6672140-f5a4-4172-8014-d6bacf9b246b'),
	('00000000-0000-0000-0000-000000000000', 18, 'se7fau3i3teh', '4960388d-ff06-4669-9573-8b093b8fc3c7', true, '2026-04-21 04:29:39.641388+00', '2026-04-21 05:29:09.211016+00', 'qcmie375kquw', 'd6672140-f5a4-4172-8014-d6bacf9b246b'),
	('00000000-0000-0000-0000-000000000000', 19, 'wm55o4dbdde7', '4960388d-ff06-4669-9573-8b093b8fc3c7', true, '2026-04-21 05:29:09.220031+00', '2026-04-22 02:49:10.007133+00', 'se7fau3i3teh', 'd6672140-f5a4-4172-8014-d6bacf9b246b'),
	('00000000-0000-0000-0000-000000000000', 20, '4okjg7mwak6z', '4960388d-ff06-4669-9573-8b093b8fc3c7', true, '2026-04-22 02:49:10.030257+00', '2026-04-22 03:51:51.201359+00', 'wm55o4dbdde7', 'd6672140-f5a4-4172-8014-d6bacf9b246b'),
	('00000000-0000-0000-0000-000000000000', 21, '3jskxdnh2j3m', '4960388d-ff06-4669-9573-8b093b8fc3c7', true, '2026-04-22 03:51:51.218352+00', '2026-04-22 12:26:45.290981+00', '4okjg7mwak6z', 'd6672140-f5a4-4172-8014-d6bacf9b246b'),
	('00000000-0000-0000-0000-000000000000', 22, '4dx3v7v6ozyy', '4960388d-ff06-4669-9573-8b093b8fc3c7', true, '2026-04-22 12:26:45.305885+00', '2026-04-22 14:24:05.535571+00', '3jskxdnh2j3m', 'd6672140-f5a4-4172-8014-d6bacf9b246b'),
	('00000000-0000-0000-0000-000000000000', 23, 'tr42ujymcp6z', '4960388d-ff06-4669-9573-8b093b8fc3c7', true, '2026-04-22 14:24:05.541698+00', '2026-04-23 09:14:29.651226+00', '4dx3v7v6ozyy', 'd6672140-f5a4-4172-8014-d6bacf9b246b'),
	('00000000-0000-0000-0000-000000000000', 24, 'rvy6yt76tvsi', '4960388d-ff06-4669-9573-8b093b8fc3c7', false, '2026-04-23 09:14:29.671866+00', '2026-04-23 09:14:29.671866+00', 'tr42ujymcp6z', 'd6672140-f5a4-4172-8014-d6bacf9b246b');


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: webauthn_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: webauthn_credentials; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: routine_time_tracker_tags; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."routine_time_tracker_tags" ("id", "created_at", "name", "color", "updated_at", "user_id", "is_deleted") VALUES
	('8ec61419-351c-45b6-9569-813252f4ccf9', '2026-04-18 10:37:37.481+00', 'Sleeping', '#365b96', '2026-04-18 10:37:37.481+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', false),
	('0ce8aa53-74d1-4cb5-bb74-de2a1eb475a5', '2026-04-18 10:37:46.279+00', 'Nap', '#4572ba', '2026-04-18 10:37:46.279+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', false),
	('bd1b739b-0be2-42e1-b948-f2b50cfb4216', '2026-04-18 09:45:53.608+00', 'Learning', '#9f6f6f', '2026-04-18 10:37:49.415+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', true),
	('c12caa77-0886-4604-b732-739c98b9dd94', '2026-04-18 10:38:05.454+00', 'Eating', '#e96235', '2026-04-18 10:38:05.454+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', false),
	('76d73987-d43a-450a-808d-78c5f30c880c', '2026-04-18 10:38:16.485+00', 'Cooking', '#e47b58', '2026-04-18 10:38:16.485+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', false),
	('2667ee59-5444-4e52-850c-3e00e5049505', '2026-04-18 10:39:51.235+00', 'Sports', '#f3f584', '2026-04-18 10:39:51.235+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', false),
	('5f2922c4-43d4-4298-8dad-91a5df6bc6cc', '2026-04-18 10:40:10.068+00', 'Deep Work', '#0bafd0', '2026-04-18 10:40:10.068+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', false),
	('59ba5b32-c161-4292-b205-b19ce32b52db', '2026-04-18 10:40:28.254+00', 'Light Work', '#7bc6d5', '2026-04-18 10:40:28.254+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', false),
	('ad8c90c8-646b-45c4-9e32-dda962a46bb6', '2026-04-18 10:40:48.984+00', 'Learn English', '#92de8c', '2026-04-18 10:40:48.984+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', false),
	('e6605b3b-1413-4a6e-9a6c-43b78c7a5389', '2026-04-18 10:41:02.507+00', 'Reading', '#4fe345', '2026-04-18 10:41:02.507+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', false),
	('a8856aaa-c606-4a2c-9b73-70c2b6525df4', '2026-04-18 10:41:15.791+00', 'Learn Music', '#20f910', '2026-04-18 10:41:15.791+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', false),
	('9b9f25be-bde6-4372-a1e1-bf54af97db6f', '2026-04-18 10:41:58.014+00', 'Entertainment', '#ee5dc0', '2026-04-18 10:41:58.014+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', false),
	('065727ef-265a-4d93-9a92-35aa7aa9c7cf', '2026-04-18 10:42:07.117+00', 'Gaming', '#d21e99', '2026-04-18 10:42:07.117+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', false),
	('21327b56-7af9-48cc-8209-da2ba04a2bb5', '2026-04-18 10:42:34.487+00', 'Others', '#80583c', '2026-04-18 10:42:34.487+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', false),
	('94b0e435-5521-47c6-92bf-6efb751b6bc6', '2026-04-18 10:42:22.511+00', 'Mobile Phone', '#f584d1', '2026-04-18 10:42:22.511+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', false),
	('e486f6e8-ba4a-471a-9680-30433d71dd93', '2026-04-18 10:39:24.713+00', 'Wash Up', '#34ea7a', '2026-04-18 10:39:24.713+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', false),
	('b0ec7c88-ddd7-40ad-8fdd-478f02ac1941', '2026-04-14 06:06:42.901293+00', 'Default', '#787878', '2026-04-18 10:24:55.241755+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', false);


--
-- Data for Name: routine_cards; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."routine_cards" ("id", "created_at", "updated_at", "user_id", "title", "start_at", "end_at", "tag_id", "is_deleted", "description") VALUES
	('805e1e39-af4f-4fbc-954d-9cf975994d51', '2026-04-14 06:16:34.686+00', '2026-04-14 06:19:36.757+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', 'New Routine Card', '2026-04-14 04:30:00+00', '2026-04-14 05:30:00+00', 'b0ec7c88-ddd7-40ad-8fdd-478f02ac1941', true, 'New Routine Card Description.'),
	('e008b1d3-694a-4e59-bcdf-ffb2c40f5cce', '2026-04-14 06:49:19.057+00', '2026-04-17 10:07:05.595+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', 'Get up', '2026-04-13 22:00:00+00', '2026-04-13 23:00:00+00', 'b0ec7c88-ddd7-40ad-8fdd-478f02ac1941', true, 'New Routine Card Description.'),
	('07b09b1f-4854-4dfd-b137-6714448784fe', '2026-04-20 02:51:48.043+00', '2026-04-20 02:51:48.043+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', 'New Routine Card 的', '2026-04-20 01:00:00+00', '2026-04-20 02:00:00+00', 'b0ec7c88-ddd7-40ad-8fdd-478f02ac1941', false, 'New Routine Card Description.'),
	('46f58986-ce54-4b17-80cf-8d783dcd239e', '2026-04-19 02:03:15.744+00', '2026-04-19 02:03:15.744+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', 'New Routine Card', '2026-04-19 23:00:00+00', '2026-04-20 00:00:00+00', 'b0ec7c88-ddd7-40ad-8fdd-478f02ac1941', false, 'New Routine Card Description.'),
	('74be4d00-5f2b-4021-92d3-6e31df9be170', '2026-04-17 10:07:15.773+00', '2026-04-21 05:39:40.172+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', 'Getup 1', '2026-04-20 18:05:00+00', '2026-04-20 19:15:00+00', '0ce8aa53-74d1-4cb5-bb74-de2a1eb475a5', false, 'New Routine Card Description.'),
	('d88cfa25-3095-4e35-b2a7-f1f0ccf623e2', '2026-04-22 03:59:35.696+00', '2026-04-22 03:59:35.696+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', 'Nap', '2026-04-21 21:00:00+00', '2026-04-21 22:00:00+00', '0ce8aa53-74d1-4cb5-bb74-de2a1eb475a5', false, '');


--
-- Data for Name: time_tracker_cards; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."time_tracker_cards" ("id", "created_at", "updated_at", "user_id", "title", "start_at", "end_at", "tag_id", "is_deleted", "description") VALUES
	('2ea8943b-e1c8-4b93-a176-ec5c0b2bd1be', '2026-04-14 06:20:40.307+00', '2026-04-14 06:45:12.858+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', 'Test Time Tracker', '2026-04-14 03:30:00+00', '2026-04-14 08:32:00+00', 'b0ec7c88-ddd7-40ad-8fdd-478f02ac1941', true, 'New TimeTracker Card Description.'),
	('5fd5b3ac-5b83-49de-b352-5c9c0989a0c6', '2026-04-17 10:08:30.449+00', '2026-04-21 04:33:57.144+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', 'New TimeTracker Card 2', '2026-04-20 20:10:00+00', '2026-04-20 22:00:00+00', 'b0ec7c88-ddd7-40ad-8fdd-478f02ac1941', false, 'New TimeTracker Card Description.'),
	('ea98c9d8-f513-4665-8f56-e8d454f53ecb', '2026-04-22 02:49:16.22+00', '2026-04-22 03:52:55.355+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', 'New TimeTracker Card', '2026-04-22 01:00:00+00', '2026-04-22 02:05:00+00', 'b0ec7c88-ddd7-40ad-8fdd-478f02ac1941', false, 'New TimeTracker Card Description.'),
	('eea45b3a-2dac-422a-8311-119c540a5a24', '2026-04-19 03:52:00.698+00', '2026-04-21 04:38:45.859+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', 'New TimeTracker a very long name', '2026-04-20 18:00:00+00', '2026-04-20 18:30:00+00', 'c12caa77-0886-4604-b732-739c98b9dd94', false, 'New TimeTracker Card Description.'),
	('89b83389-d97d-42c2-9467-f30255b8e9f0', '2026-04-21 03:14:48.221+00', '2026-04-21 04:18:09.681+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', 'Eating', '2026-04-21 03:14:00+00', '2026-04-21 04:19:00+00', 'c12caa77-0886-4604-b732-739c98b9dd94', false, 'New TimeTracker Card Description.'),
	('70c8f3b7-f6ec-43f7-83ed-cfb291fdcbae', '2026-04-22 12:26:51.53+00', '2026-04-22 14:24:04.214+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', 'Light Work', '2026-04-22 12:26:00+00', '2026-04-22 14:25:00+00', '59ba5b32-c161-4292-b205-b19ce32b52db', false, ''),
	('cc74de62-9d72-41cb-85af-0d32526e578c', '2026-04-21 04:25:27.437+00', '2026-04-21 04:30:25.697+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', 'Test', '2026-04-21 04:25:00+00', '2026-04-21 04:31:00+00', '5f2922c4-43d4-4298-8dad-91a5df6bc6cc', false, 'New TimeTracker Card Description.'),
	('d0630981-2e54-4f47-859d-351d1a114d66', '2026-04-21 04:42:34.356+00', '2026-04-22 14:28:11.807+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', 'New TimeTracker Card', '2026-04-22 06:35:00+00', '2026-04-22 10:20:00+00', '59ba5b32-c161-4292-b205-b19ce32b52db', false, 'New TimeTracker Card Description.'),
	('d9ea043d-d547-4818-b0a3-5cef5e1c2c4d', '2026-04-22 14:25:29.872+00', '2026-04-23 10:10:07.202+00', '4960388d-ff06-4669-9573-8b093b8fc3c7', 'Nap', '2026-04-22 14:25:00+00', '2026-04-23 10:12:00+00', '0ce8aa53-74d1-4cb5-bb74-de2a1eb475a5', false, '');


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 24, true);


--
-- PostgreSQL database dump complete
--

-- \unrestrict wJsj6IdH8jtNUMHhukOWtrOIDwcTnPWtbWNmwGKugtu2XcPFdYDthBszSbeVUg9

RESET ALL;
