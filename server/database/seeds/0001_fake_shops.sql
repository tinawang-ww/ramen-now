-- Fake data for local development.
--
-- Explicit ids + `insert or ignore` keep this idempotent: re-running never
-- duplicates a shop or double-counts a report. Report timestamps are relative
-- to when the seed runs, so some rows are always inside the 90-minute fresh
-- window and some are always stale.
--
--   pnpm db:seed

insert or ignore into shops (id, name, lat, lng, created_at) values
  (1,  '麵屋 一心',     25.0525, 121.5203, unixepoch() - 86400 * 30),
  (2,  '豚骨 山下',     25.0421, 121.5081, unixepoch() - 86400 * 28),
  (3,  '鶏白湯 三日月', 25.0330, 121.5654, unixepoch() - 86400 * 25),
  (4,  '拉麵 小巷',     25.0345, 121.5290, unixepoch() - 86400 * 21),
  (5,  '味噌 北堂',     25.0143, 121.5340, unixepoch() - 86400 * 18),
  (6,  '沾麵 竹取',     25.0937, 121.5259, unixepoch() - 86400 * 14),
  (7,  '家系 大黑',     25.0800, 121.5910, unixepoch() - 86400 * 11),
  (8,  '清湯 潮屋',     25.0143, 121.4670, unixepoch() - 86400 * 7),
  (9,  '辣味噌 火群',   25.0553, 121.6070, unixepoch() - 86400 * 4),
  (10, '拉麵 天母亭',   25.1177, 121.5320, unixepoch() - 86400 * 2);

-- Seats go on in a second pass, so a database an earlier seed already created
-- picks them up too — `insert or ignore` above would skip those rows.
--
-- The three cases the row has to draw are all here: both counted, counter-only
-- (no tables is an answer, not a gap), and nobody counted yet — 沾麵 竹取 and
-- 清湯 潮屋 are left out below, so they draw no seat icons at all.
with seats(id, counter, tables) as (values
  (1,  12, 16),
  (2,  9,  0),
  (3,  14, 8),
  (4,  7,  0),
  (5,  20, 32),
  (7,  18, 12),
  (9,  24, 40),
  (10, 10, 4)
)
update shops set
  counter_seats = (select counter from seats where seats.id = shops.id),
  table_seats = (select tables from seats where seats.id = shops.id)
where id in (select id from seats);

insert or ignore into reports (id, shop_id, people, created_at) values
  -- 麵屋 一心 — busy and freshly reported.
  (1,  1, 12, unixepoch() - 60 * 4),
  (2,  1, 9,  unixepoch() - 60 * 26),
  (3,  1, 14, unixepoch() - 60 * 70),
  -- 豚骨 山下 — fresh, short line.
  (4,  2, 3,  unixepoch() - 60 * 11),
  (5,  2, 6,  unixepoch() - 60 * 48),
  -- 鶏白湯 三日月 — fresh, empty.
  (6,  3, 0,  unixepoch() - 60 * 18),
  (7,  3, 2,  unixepoch() - 60 * 55),
  (8,  3, 7,  unixepoch() - 60 * 130),
  -- 拉麵 小巷 — just past the fresh window, so it reads as dimmed.
  (9,  4, 5,  unixepoch() - 60 * 95),
  (10, 4, 8,  unixepoch() - 60 * 150),
  -- 味噌 北堂 — student crowd, fresh.
  (11, 5, 21, unixepoch() - 60 * 7),
  (12, 5, 18, unixepoch() - 60 * 35),
  (13, 5, 25, unixepoch() - 60 * 80),
  (14, 5, 11, unixepoch() - 60 * 240),
  -- 沾麵 竹取 — stale afternoon report.
  (15, 6, 4,  unixepoch() - 60 * 200),
  -- 家系 大黑 — fresh, moderate.
  (16, 7, 7,  unixepoch() - 60 * 23),
  (17, 7, 10, unixepoch() - 60 * 62),
  -- 清湯 潮屋 — one very old report.
  (18, 8, 2,  unixepoch() - 86400),
  -- 辣味噌 火群 — long line, fresh.
  (19, 9, 34, unixepoch() - 60 * 2),
  (20, 9, 29, unixepoch() - 60 * 40);
  -- 拉麵 天母亭 (id 10) is left unreported on purpose: the "還沒有人回報" state.

-- Two standing report requests, so the dot next to the name shows up in dev.
-- Plain updates rather than `insert or ignore`, so re-seeding refreshes them
-- instead of letting them age out of the three-hour window.
update shops set requested_at = unixepoch() - 60 * 12 where id = 10;
update shops set requested_at = unixepoch() - 60 * 25 where id = 6;
