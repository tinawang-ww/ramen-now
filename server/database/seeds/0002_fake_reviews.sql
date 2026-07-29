-- Fake write-ups for local development. Depends on 0001_fake_shops.sql for the
-- shop ids, so it has to run after it.
--
-- Explicit ids + `insert or ignore` keep this idempotent. Timestamps are
-- relative to when the seed runs, so the relative-time labels always read
-- sensibly no matter how old the local database is.
--
--   pnpm db:seed

-- Authors. docs/passkey deliberately seeds no users because a passkey can't be
-- faked — an author's name isn't under that constraint. These users have no
-- credential, so nobody can sign in as them; they only give write-ups a byline.
insert or ignore into users (id, label, created_at) values
  (901, '拉麵Now #a3f1', unixepoch() - 86400 * 60),
  (902, '拉麵Now #7c02', unixepoch() - 86400 * 45),
  (903, '拉麵Now #e59b', unixepoch() - 86400 * 30),
  (904, '拉麵Now #1d44', unixepoch() - 86400 * 12);

insert or ignore into reviews (id, shop_id, user_id, ramen, price, queue, body, created_at) values
  -- 麵屋 一心 — three of them, so ordering within one shop is verifiable.
  (1, 1, 901, '特製濃厚豚骨', 320, '排了 25 分鐘左右',
   '湯頭是那種喝完會口渴一整天的濃度，但值得。麵偏硬，正好。', unixepoch() - 60 * 20),
  -- The multi-line one, for whitespace-pre-line.
  (2, 1, 903, '醬油叉燒麵', 260, '假日中午別來，排到轉角',
   '叉燒三片，邊緣有燒過的香氣。' || char(10) || '湯比隔壁桌的豚骨清爽很多，第一次來可以先點這個。' || char(10) || '半熟蛋要加點，不含在裡面。',
   unixepoch() - 86400 * 2),
  (3, 1, 902, '特製濃厚豚骨', 320, '沒排隊，直接坐',
   '平日晚上九點多進去，整間只有三個人。同一碗同樣好吃，只是少了排隊那種期待感。', unixepoch() - 86400 * 11),
  -- 豚骨 山下 — cheap and quick, the counterpoint to 一心.
  (4, 2, 902, '豚骨拉麵', 180, '排兩三個人，五分鐘就進去',
   '一百八吃到這樣沒什麼好挑的。加麵免費，記得進去就先講。', unixepoch() - 60 * 90),
  (5, 2, 904, '味玉豚骨', 220, '沒排隊',
   '蛋的溏心剛好，湯稍微鹹了一點，配白飯剛好。', unixepoch() - 86400 * 6),
  -- 鶏白湯 三日月 — the expensive end of the range.
  (6, 3, 901, '濃厚鶏白湯', 380, '排了快四十分鐘',
   '湯稠到湯匙立得起來。好吃，但一年吃一次就夠了。', unixepoch() - 60 * 200),
  (7, 3, 903, '柚子鹽鶏湯', 300, '排了十分鐘',
   '柚子香氣很清楚，夏天喝這個比濃厚的舒服太多。', unixepoch() - 86400 * 19),
  -- 拉麵 小巷 — the one everyone recommends but nobody can get into.
  (8, 4, 904, '限定牛骨麵', 420, '五點半到，已經有二十個人',
   '一天限量四十碗，賣完就關。排到的那天覺得自己很幸運，沒排到的兩次也記得很清楚。',
   unixepoch() - 86400 * 4),
  -- 味噌 北堂 — student crowd, cheap.
  (9, 5, 902, '札幌味噌', 240, '排了十五分鐘，多半是學生',
   '味噌很厚，玉米奶油要加。份量對得起價錢。', unixepoch() - 60 * 320),
  (10, 5, 904, '辛味噌', 260, '沒排隊，但裡面滿座',
   '辣度可以選，選了二號就有點吃力。麵量偏多。', unixepoch() - 86400 * 26),
  -- 沾麵 竹取 — a dissenting write-up, so the feed isn't all praise.
  (11, 6, 903, '濃厚沾麵', 290, '沒排隊',
   '麵條很漂亮，但沾醬鹹得蓋掉其他味道。最後剩了半碗醬。', unixepoch() - 86400 * 9),
  -- 家系 大黑 — the one worth the trip.
  (12, 7, 901, '家系醬油豚骨', 340, '排了二十分鐘，隊伍移動很快',
   '油多、蒜多、麵硬，全部都可以調。第一次去照店員建議點普通就好。', unixepoch() - 60 * 45),
  (13, 7, 902, '家系醬油豚骨', 340, '中午十二點整到，排第一個',
   '海苔拿來包飯吃是對的。回家路上還聞得到蒜味。', unixepoch() - 86400 * 33),
  -- 辣味噌 火群 — the oldest one in the feed.
  (14, 9, 903, '地獄辣味噌', 280, '排了五分鐘',
   '辣是真的辣，不是甜辣。喝到最後嘴唇會麻，冰水記得先要一杯。', unixepoch() - 86400 * 40);

-- 清湯 潮屋 (id 8) and 拉麵 天母亭 (id 10) are left with no write-ups on purpose:
-- one exercises the empty feed state, both exercise "found the shop, no write-ups".
