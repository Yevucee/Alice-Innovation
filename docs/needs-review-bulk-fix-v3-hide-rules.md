# Bulk-fix v3 hide rules (prod v2 follow-up)

## digital-africa (18 hides in v2)

Typical pattern: portfolio rows where **`canonical_title` equals the site brand** (`Digital Africa`) and the listing page reused site chrome. v2 often hit **`site_brand_title_unrepaired`** when URL slug/metadata did not yield a better title, or **`duplicate_title_url_body`** when two rows shared the same portfolio URL + thin body.

**v3:** same repair path as Atlas — `repairSiteBrandPlaceholderTitle` from `source_items.title`, metadata, or `/portfolio/{slug}` on `digital-africa.co`. Hide only when still unrepaired.

## ventures-platform (20 hides in v2)

Same as digital-africa: **`Ventures Platform`** placeholder title on `/portfolio-companies/{slug}` pages. Rules: **`site_brand_title_unrepaired`**, **`source_name_equals_title`**, or **`duplicate_title_url_body`** when fingerprint matched (title + URL + external id + 400-char body).

**v3:** brand repair from URL slug; hide only if no usable project title remains.

## mit-solve (27 hides in v2)

Most real names (e.g. Digizen Digital ID) were **`duplicate_title_url_body`** false positives: identical thin listing body + empty URL made fingerprints collide. v3 fingerprint includes **canonical URL + `source_external_id`**. Only **`single_letter_title`** (`a`) and **`mit_solve_person_name_stub`** hide multi-word projects now.

## wipo-green

Same patent title, different URLs: **not** duplicates in v3 (URL in fingerprint). Second copy hidden only when URL **and** body match.

## Still hidden (unchanged)

- NIA **Advance Search** → `navigation_title` / `site_chrome_title`
- MOE portal titles → `government_portal_title`
- In5 **Green Room** → `site_chrome_title` or `in5_green_room_title`
- Unrepairable site-brand-only rows → `site_brand_title_unrepaired`

Hide samples (up to **150**) include `hide:<rule>` and URL. Atlas repairs listed under `atlas_site_title_repairs` (20 samples).
