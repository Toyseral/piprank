# Restore full api/content.js on admin-hub-country-publishing

Current tip may have a partial content.js. Restore the full API + country visibility as follows:

```bash
git fetch origin
git checkout admin-hub-country-publishing
# or: git checkout -B admin-hub-country-publishing origin/admin-hub-country-publishing

# Restore full content.js from last known good full version in history
git show 1457de1:api/content.js > api/content.js

# Apply country visibility + authors patch
git apply scripts/content-country-visibility.patch
# If authors block is missing, also ensure router has:
#   if (resource === 'authors') return await handleAuthors(req, res);

node --check api/content.js
git add api/content.js
git commit -m "Restore full content.js with country visibility filtering"
git push origin admin-hub-country-publishing
```

Do NOT merge this branch into develop until content.js is fully restored.
