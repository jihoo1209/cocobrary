# CocoTree MVP

Mobile-first shared vacation photo album prototype built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS v4
- Supabase Auth, Database, and Storage

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and fill in your Supabase project values:

```bash
cp .env.example .env.local
```

3. Run the app:

```bash
npm run dev
```

4. Open `http://localhost:3000`

## Asset placement

Place these files in [`public/assets`](/Users/huji/Desktop/coconut album/public/assets):

- `coconut-tree.png`
- `coconut-01.png`
- `coconut-02.png`
- `coconut-03.png`
- `coconut-04.png`

Future transparent accessory PNGs can also live here, for example:

- `accessory-sunglasses.png`
- `accessory-flower-pink.png`
- `accessory-skirt-green.png`

The current MVP uses CSS/SVG-like placeholder layers for accessories so you can keep expanding without changing the data model.

## Supabase setup

1. Run [`supabase/schema.sql`](/Users/huji/Desktop/coconut album/supabase/schema.sql) in the Supabase SQL editor.
2. Enable Auth providers you want to use.
3. Create one trip row, then add `trip_members` for invited users.
4. Store photos in the `trip-photos` bucket with paths like:

```text
<trip_uuid>/<uploader_member_uuid>/<timestamp>-photo.jpg
```

## Project structure

```text
app/
  layout.tsx
  page.tsx
  globals.css
  trip/[tripId]/page.tsx
  trip/[tripId]/customize/page.tsx
  trip/[tripId]/album/[memberId]/page.tsx
  trip/[tripId]/album/[memberId]/album-page-client.tsx
components/
  album-gallery.tsx
  coconut-avatar.tsx
  coconut-customizer.tsx
  coconut-tree-stage.tsx
  photo-uploader.tsx
lib/
  data.ts
  mock-data.ts
  types.ts
  supabase/browser.ts
  supabase/server.ts
public/assets/
  coconut-tree.png
  coconut-01.png
  coconut-02.png
  coconut-03.png
  coconut-04.png
supabase/
  schema.sql
```

## Notes

- The frontend falls back to mock demo content if Supabase env vars are not set yet.
- Coconut customization is stored as JSON-friendly fields instead of pre-rendered image combinations.
- `photo_targets` lets one uploaded image belong to multiple friends.
- Storage paths are separated from targeting metadata, so album logic stays flexible.
