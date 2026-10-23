# Microsoft setup (one time)

You do these steps yourself in your own Microsoft 365 tenant. Nothing here is
automated, and Claude never signs in to your tenant. It takes about 20 minutes.

When you're done you'll have four values for `.env.local`:
`VITE_AAD_CLIENT_ID`, `VITE_AAD_TENANT_ID`, `VITE_SP_SITE_ID`, `VITE_SP_LIST_ID`.

> Portal menu names change from time to time. If a label below doesn't
> match exactly, look for the closest one.

## 1. Create a site and the list

1. In SharePoint, create a new **Team site** (or reuse one you own), for
   example `Day Planner`.
2. In that site: **New → List → Blank list**, named `DayPlannerTasks`.
3. Add these columns. Type each **name exactly as shown, with no spaces**.
   SharePoint fixes a column's internal name when you create it, and the
   app uses those internal names.

   | Column name | Type | Settings |
   |---|---|---|
   | `Title` | (already there) | |
   | `TaskStart` | Date and time | Include time: **Yes** |
   | `TaskEnd` | Date and time | Include time: **Yes** |
   | `TaskOriginalEnd` | Date and time | Include time: **Yes** |
   | `TaskActualStart` | Date and time | Include time: **Yes** |
   | `TaskActualEnd` | Date and time | Include time: **Yes** |
   | `TaskCategory` | Choice | `office`, `projects`, `youtube`, `recording`, `editing`, `learning`, `health`, `personal`, `breaks` |
   | `TaskStatus` | Choice | `planned`, `done`, `skipped`; default `planned` |
   | `TaskDescription` | Multiple lines of text | **Plain text** (not rich text). Optional; the app saves at most 500 characters |

   The routines list (`Templates`) gets the same kind of column, named `Description`,
   which the Morning flow copies into each day's task.

4. **Index `TaskStart`:** List settings → **Indexed columns** → Create a new
   index → `TaskStart`. The app filters by start time, and Graph filters
   "work best on indexed columns" ([List items, Microsoft Learn][list]).

## 2. Register the app (Microsoft Entra admin center)

1. Go to **entra.microsoft.com** → Identity → Applications → **App
   registrations** → **New registration**.
2. Name: `Day Planner`. Supported account types: **this organizational
   directory only** (single tenant).
3. Leave the Redirect URI **empty** during creation, as Microsoft's SPA guide
   says, and add it in the next step ([SPA registration][spa]).
4. Open the new app → **Authentication** → **Add a platform** →
   **Single-page application**. Add both redirect URIs:
   - `http://localhost:5173/`
   - `https://shbh-mirai.github.io/day-planner/`
5. On the app's **Overview** page, copy:
   - **Application (client) ID** → `VITE_AAD_CLIENT_ID`
   - **Directory (tenant) ID** → `VITE_AAD_TENANT_ID`

## 3. Give the app permission to one site only

1. App → **API permissions** → **Add a permission** → Microsoft Graph →
   **Delegated permissions** → tick **`Sites.Selected`** → Add.
2. Click **Grant admin consent for <your tenant>**.

`Sites.Selected` alone gives access to **no** sites. Step 4 grants it your one
site ([delegated Sites.Selected, Microsoft 365 Dev Blog][selected]).

## 4. Grant the app write access to your site (Graph Explorer)

This call needs delegated `Sites.FullControl.All`, and you must be a SharePoint
Administrator (or higher) and a member of the site ([Create permission][perm]).

1. Open **Graph Explorer** (developer.microsoft.com/graph/graph-explorer) and
   sign in as your admin account. Consent to `Sites.FullControl.All` when it
   asks (Modify permissions tab).
2. Find your site ID. Run:
   `GET https://graph.microsoft.com/v1.0/sites/<your-tenant>.sharepoint.com:/sites/<site-path>`
   and copy `id` (it looks like `host,guid,guid`) → `VITE_SP_SITE_ID`.
3. Grant the app write access. Run
   `POST https://graph.microsoft.com/v1.0/sites/<site-id>/permissions`
   with this body (copied from the [Create permission][perm] example; put
   in your client ID):

   ```json
   {
     "roles": ["write"],
     "grantedToIdentities": [{
       "application": { "id": "<VITE_AAD_CLIENT_ID>", "displayName": "Day Planner" }
     }]
   }
   ```

   Expected: `201 Created`.
4. Find the list ID. Run:
   `GET https://graph.microsoft.com/v1.0/sites/<site-id>/lists?$select=id,displayName`
   and copy the `id` of `DayPlannerTasks` → `VITE_SP_LIST_ID`.

## 5. Fill in `.env.local`

```bash
VITE_STORAGE=sharepoint
VITE_AAD_CLIENT_ID=<from step 2>
VITE_AAD_TENANT_ID=<from step 2>
VITE_SP_SITE_ID=<from step 4>
VITE_SP_LIST_ID=<from step 4>
VITE_GRAPH_SCOPE=
```

Leave `VITE_GRAPH_SCOPE` empty to use `Sites.Selected`.

## If step 4 fails: fallback permission

UNVERIFIED: Microsoft's list-item API pages name only
`Sites.Read.All` / `Sites.ReadWrite.All` and don't mention `Sites.Selected`
([List items][list], [Create item][create]). If saving fails with a 403
error after the steps above:

1. API permissions → add delegated **`Sites.ReadWrite.All`** → grant admin consent.
2. In `.env.local` set
   `VITE_GRAPH_SCOPE=https://graph.microsoft.com/Sites.ReadWrite.All`.

This is broader access, but still never more than your own account can do.

[spa]: https://learn.microsoft.com/en-us/entra/identity-platform/scenario-spa-app-registration
[selected]: https://devblogs.microsoft.com/microsoft365dev/sharepoint-now-supports-delegated-sites-selected-authentication/
[perm]: https://learn.microsoft.com/en-us/graph/api/site-post-permissions?view=graph-rest-1.0
[list]: https://learn.microsoft.com/en-us/graph/api/listitem-list?view=graph-rest-1.0
[create]: https://learn.microsoft.com/en-us/graph/api/listitem-create?view=graph-rest-1.0
