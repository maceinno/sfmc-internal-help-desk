-- ============================================================================
-- 022_branding_brand_colors.sql
-- Save SFMC's brand colours as the Admin → Branding colours.
--
-- Client decision 2026-10-05: primary #242E38, secondary/accent #C98726 (the
-- gold in the saved logo — checked by decoding the logo PNG: its two solid
-- colours are #FCF5ED and #C98726).
--
-- WHY THIS IS A MIGRATION, NOT "GO AND SAVE IT"
--   Until this release the colour pickers were saved but applied nowhere, and
--   the one row held the page's old built-in defaults, never chosen by anyone.
--   Measured 2026-10-05 (service-role read of branding_config, the shared
--   preview/production project): id 1, primary_color '#2563eb' (blue),
--   accent_color '#7c3aed' (purple). The same release starts APPLYING the
--   colours, so without this update buttons would turn blue and the sidebar
--   highlight purple on publish.
--
-- SAFE TO RE-RUN, AND IT NEVER OVERWRITES A CHOICE
--   Only touches the row while it still holds exactly those untouched
--   defaults (or nothing). Once anyone saves colours on the Branding page,
--   this matches no row. Old code ignores these columns, so it is safe in
--   either order relative to the new build.
-- ============================================================================

UPDATE branding_config
   SET primary_color = '#242E38',
       accent_color  = '#C98726'
 WHERE COALESCE(lower(primary_color), '#2563eb') = '#2563eb'
   AND COALESCE(lower(accent_color),  '#7c3aed') = '#7c3aed';
