-- Extra settings keys for admin-editable website content/branding.
-- Seeded with the current copy so nothing changes visually until an admin edits them.
insert into public.settings (key, value) values
  ('hero_eyebrow', 'Read & Listen, In Your Language'),
  ('hero_headline', 'A library fit for you, in the palm of your hand.'),
  ('hero_subtext', 'King''s Library is a private reading app where every book — and every podcast — is in your language, protected, beautifully presented, and truly yours to enjoy.'),
  ('about_text', E'King''s Library is a home for books and podcasts that deserve your full attention — in your own language, at your own pace, without your reading or listening being copied or taken from you.\n\nIt''s a space for growth — spiritual, personal, and creative — built with real care for craft and quality, carried into every written word and spoken voice.\n\nWhether you''re picking up a short story on your lunch break, listening to a podcast on your commute, or settling in for a longer read in the evening, King''s Library aims to feel like your own private, well-kept shelf for growth — wherever you are.'),
  ('footer_text', '© King''s Library. All books remain the property of their respective authors.'),
  ('logo_url', ''),
  ('accent_color', '#F0C25E')
on conflict (key) do nothing;
