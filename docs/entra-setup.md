# Entra ID Setup — Single App Registration with App Roles

## 1. Register the App

1. Go to **Azure Portal** > **Microsoft Entra ID** > **App registrations** > **New registration**
2. Name: `Atelier`
3. Supported account types: **Single tenant** (Accounts in this organizational directory only)
4. Redirect URI: Select **Single-page application (SPA)**, enter `http://localhost:5173`
5. Click **Register**

Note down from the **Overview** page:
- **Application (client) ID** — e.g. `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
- **Directory (tenant) ID** — e.g. `f0e1d2c3-b4a5-6789-0abc-def123456789`

## 2. Add Production Redirect URI

1. Go to **Authentication** > **Single-page application** > **Add URI**
2. Add your production URL: `https://atelier.yourdomain.com`
3. Click **Save**

## 3. Restrict Access (Assignment Required)

By default any tenant user can sign in. To restrict to specific people:

1. Go to **Microsoft Entra ID** > **Enterprise applications** (not App registrations)
2. Find `Atelier` in the list
3. Go to **Properties**
4. Set **Assignment required?** to **Yes**
5. Click **Save**

Now only assigned users can access the app.

## 4. Define App Roles

Roles control what each user can do inside Atelier. They are embedded in the JWT token so the API can check permissions without any external calls.

1. Go to **Azure Portal** > **Microsoft Entra ID** > **App registrations** > click `Atelier`
2. In the left sidebar, click **App roles**
3. Click **Create app role**

### Role 1: Admin

| Field | Value |
|---|---|
| Display name | `Admin` |
| Allowed member types | **Users/Groups** |
| Value | `Admin` (case-sensitive — must match exactly) |
| Description | `Full access — manage all projects, delete any project, access admin settings` |
| Do you want to enable this app role? | **Yes** (checked) |

Click **Apply**.

### Role 2: Designer

Click **Create app role** again.

| Field | Value |
|---|---|
| Display name | `Designer` |
| Allowed member types | **Users/Groups** |
| Value | `Designer` |
| Description | `Create and edit own projects, generate screens, export code` |
| Do you want to enable this app role? | **Yes** (checked) |

Click **Apply**.

### Role 3: Viewer

Click **Create app role** again.

| Field | Value |
|---|---|
| Display name | `Viewer` |
| Allowed member types | **Users/Groups** |
| Value | `Viewer` |
| Description | `View projects only — no generation, editing, or deletion` |
| Do you want to enable this app role? | **Yes** (checked) |

Click **Apply**.

### What each role can do

| Action | Admin | Designer | Viewer |
|---|:---:|:---:|:---:|
| View project library | Y | Y | Y |
| Open and view screens | Y | Y | Y |
| Create new projects | Y | Y | - |
| Generate screens (AI) | Y | Y | - |
| Edit screens | Y | Y | - |
| Delete own projects | Y | Y | - |
| Delete any project | Y | - | - |
| View all users' projects | Y | - | - |
| Access admin settings | Y | - | - |

### Important notes

- The **Value** field is what appears in the JWT `roles` claim — it must be `Admin`, `Designer`, or `Viewer` exactly (case-sensitive)
- Users with **no role assigned** default to `Viewer` permissions in the API
- API key users automatically get `Admin` role
- You can assign the same user multiple roles, but typically one role per user is sufficient
- Roles can also be assigned to **Azure AD groups** — useful if you want "everyone in the Design team gets Designer role"

## 5. Assign Users to Roles

1. Go to **Enterprise applications** > `Atelier`
2. Go to **Users and groups** > **Add user/group**
3. Select a user > Select a role (Admin, Designer, or Viewer)
4. Click **Assign**
5. Repeat for each user who needs access

## 6. Configure Environment Variables

Add these to your `.env` file:

```env
AUTH_MODE=entra

AZURE_TENANT_ID=f0e1d2c3-b4a5-6789-0abc-def123456789
AZURE_CLIENT_ID=a1b2c3d4-e5f6-7890-abcd-ef1234567890
VITE_AZURE_CLIENT_ID=a1b2c3d4-e5f6-7890-abcd-ef1234567890
VITE_AZURE_TENANT_ID=f0e1d2c3-b4a5-6789-0abc-def123456789
```

Note: `AZURE_CLIENT_ID` and `VITE_AZURE_CLIENT_ID` are the **same value**. The `VITE_` prefix makes it available to the frontend (Vite only exposes `VITE_` prefixed vars to the browser).

## 7. Auth Modes

| `AUTH_MODE` | Behaviour |
|---|---|
| `apikey` (default) | API key only. No Entra. Set `ATELIER_API_KEY` to require a key, or leave blank for open access. |
| `entra` | Entra only. All requests must have a valid JWT from Microsoft. |
| `both` | Try API key first, then Entra JWT. Useful during migration. |

## 8. How Roles Work at Runtime

When a user signs in via Entra, their JWT contains a `roles` claim:

```json
{
  "oid": "user-object-id",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "roles": ["Admin"]
}
```

The API server:
1. Validates the JWT signature via Microsoft's JWKS endpoint
2. Extracts `oid`, `email`, `name`, and `roles` from the token
3. Upserts the user in SQLite (first login creates the record)
4. Attaches `{ userId, email, displayName, roles }` to the request context

Routes can then check roles:
```typescript
requireRole(req, "Admin", "Designer"); // throws 401 if user is only Viewer
```

Users with **no roles assigned** default to `Viewer`.

API key users get `Admin` role by default.

## 9. Token Flow

```
Browser                    Entra ID                   API Server
  │                          │                            │
  ├─ loginRedirect() ───────►│                            │
  │                          │◄─ user authenticates       │
  │◄─── access token ────────│                            │
  │                          │                            │
  ├─ Authorization: Bearer <token> ─────────────────────►│
  │                          │     verify JWT via JWKS ───┤
  │                          │     extract oid + roles ───┤
  │                          │     upsert user in SQLite ─┤
  │◄─────────────────────────────── response ─────────────┤
```

## 10. Testing Locally

1. Set `AUTH_MODE=both` during development so API key still works
2. Sign in via Microsoft on the login page
3. Check the browser console for `[msal]` logs
4. Check `GET /api/me` to see your user profile and roles

## Troubleshooting

| Issue | Solution |
|---|---|
| "AADSTS50011: Reply URL mismatch" | Add `http://localhost:5173` as a SPA redirect URI in Authentication |
| "AADSTS700016: Application not found" | Check `VITE_AZURE_CLIENT_ID` matches the app registration |
| User gets "You don't have access" | Assign them in Enterprise applications > Users and groups |
| `roles` is empty in token | Check the user has a role assigned, and App Roles are defined correctly |
| Token validation fails on API | Check `AZURE_TENANT_ID` and `AZURE_CLIENT_ID` match the app registration |
