# TODO - Episode Manager UX Upgrade (Anify)

## Step 0 (Admin UI consolidation) ✅
- Ensure Admin UI routes (admin tab rendering + modal) are driven exclusively by `js/admin/adminUI.js`.
- Remove or confine competing Admin UI implementations inside `script.js` that override episode management UX.

## Step 1 (UI refactor)
- Update `js/admin/adminUI.js` modal:
  - Remove “Episodes” field completely.
  - Ensure Movies modal shows only movie fields (no episode fields).
  - Ensure Series/episode modal shows episode fields only.

## Step 2 (Manage Episodes UI)
- Update `renderAdminAnime()` in `js/admin/adminUI.js`:
  - Change row actions to: Edit Anime / Manage Episodes / Delete Anime.
  - Ensure Manage Episodes triggers the episode hub view.

## Step 3 (Episode history list + actions)
- Implement episode list rendering with Edit/Delete actions.
- Wire edit to open episode upload form prefilled.
- Wire delete to call backend `DELETE /api/anime/:id/episodes/:episodeNumber`.

## Step 4 (Add New Episode UX)
- Implement “+ Add New Episode” which expands the upload form.
- Auto-fill next episode number based on current `episodesMedia`.

## Step 5 (Existing episode detection)
- When episode number input matches an existing episode:
  - show warning
  - show Update Existing vs Cancel (instead of allowing duplicate create UX).
  - Ensure PUT endpoint is used for upsert.

## Step 6 (Collapse upload sections)
- Collapse video upload inputs:
  - 1080p ▼ (Sub + Dub)
  - 720p ▼ (Sub + Dub)

## Step 7 (Post-validation)
- Manual test checklist:
  - Admin row actions behave correctly.
  - Manage Episodes loads existing episodes.
  - Add New Episode auto-fills.
  - Episode number collision shows update UI.
  - Movie modal has no episode fields.

