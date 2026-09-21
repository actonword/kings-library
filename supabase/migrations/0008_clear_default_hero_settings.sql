-- hero_eyebrow/hero_headline/hero_subtext/about_text/footer_text were seeded in
-- migration 0006 with real English text (so the admin form wouldn't look empty).
-- But applySiteCustomizations() treats any non-empty value as an explicit admin
-- override and applies it in ALL languages via textContent, which both broke
-- Hindi/Punjabi translation (always showing English) and stripped the gold-highlight
-- <span> around "you" in the hero headline (setHTML → textContent overwrite).
--
-- Clearing them back to empty restores the default behavior: the built-in per-language
-- translations (with the highlighted span) control these fields until an admin
-- deliberately types something into Settings — at which point it's expected to apply
-- as plain single-language text, same as before.
update public.settings
set value = ''
where key in ('hero_eyebrow', 'hero_headline', 'hero_subtext', 'about_text', 'footer_text');
