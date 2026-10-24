# Student Notes Sharing Platform (NoteNest)

A responsive student library for sharing notes, previous question papers, lab records and study materials. It supports search, filters, preview, downloads, favourites, import and export.

## Important: enable shared uploads

The project now supports **Supabase cloud storage**. To make a file uploaded by one student appear for another student on a different device, complete the setup below. Until then, the app runs in local demo mode and files remain in that browser only.

### 1. Create a Supabase project

1. Visit https://supabase.com/ and create a project.
2. In **Project Settings → API** (or **Data API / API Keys**, depending on the dashboard), copy the Project URL and the publishable/anon key.
3. Never use or expose a `service_role` / secret key in browser code.

### 2. Create the database and storage bucket

1. Open **SQL Editor** in your Supabase project.
2. Open `supabase-setup.sql` from this project, copy its contents into the SQL editor and run it.
3. This creates the `files` table, the `study-files` bucket, and access policies.

**Security note:** The included SQL is configured for a public demo: anyone who can access the site can read, upload, edit, or delete shared files. Do not use this configuration for sensitive/private notes. For production use, enable Supabase Auth and restrict database and storage policies to authenticated users and file owners.

### 3. Add your Supabase keys

Open `config.js` and replace the two placeholders:

```js
window.NOTENEST_CONFIG = {
  SUPABASE_URL: 'https://YOUR-PROJECT-REF.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_PUBLISHABLE_OR_ANON_KEY',
  STORAGE_BUCKET: 'study-files'
};
```

Keep the URL and publishable/anon key in quotes. Do not paste your service-role key.

### 4. Deploy

1. Save all files.
2. Commit and push the project folder to GitHub.
3. In Vercel, import or redeploy that GitHub repository.
4. Open the deployed website in two different browsers/devices. Upload a small test PDF from one browser, then refresh the other browser. The same file should appear and be downloadable.

### Notes about existing files

Files uploaded before cloud storage was configured exist only in the original browser's IndexedDB. They are not automatically copied to Supabase. Configure Supabase first, then re-upload those files (or export/import a backup while using the appropriate cloud setup).

## Run locally

For local development, open the folder in VS Code and use a local web server extension such as Live Server. Supabase requests require internet access. Opening `index.html` directly may work for local demo mode, but a local web server is recommended.

## Project files

- `index.html` — page layout
- `style.css` — responsive styling
- `app.js` — UI, uploads, previews, downloads, search and filters
- `db.js` — Supabase cloud storage adapter with IndexedDB local fallback
- `config.js` — Supabase project configuration placeholders
- `supabase-setup.sql` — database, bucket and demo access policies
- `sample.js` — sample files for demonstration
- `login.html`, `login.js`, `login.css` — login demo screens (the included login is browser-based, not Supabase authentication)
