# NutriWise

Run: `node server.js` (Node 16+, no installs needed)

- Website: http://localhost:3000
- Admin: http://localhost:3000/admin — default password `admin123` (change with `ADMIN_PASSWORD=yourpass node server.js`)

All data lives in `data.json` (auto-created). Edits in admin appear on the public site on refresh.

## HM integration
In Admin → Products: edit each product and set the real name, price, description, badges and a photo URL
(place image files in `public/` and use e.g. `/pandesal.jpg`).

## Demo flow
1. Public site → submit the inquiry form.
2. Admin → Inquiries → click the status tag to move New → Quoted → Confirmed.
3. Admin → toggle stock or edit a price → refresh the public site.
