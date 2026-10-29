# Publishing Godhuli

There are two registries:

| Registry | Who installs from it | Tool |
|---|---|---|
| **VS Code Marketplace** (Microsoft) | VS Code | `@vscode/vsce` |
| **Open VSX** (Eclipse Foundation) | Cursor, VSCodium, Windsurf, Gitpod, Theia | `ovsx` |

Both are free. Neither tool needs a global install, because the `npm run …` scripts call them through `npx`.

---

## 0. One-time preparation

### 0.1 Put the project on GitHub

The Marketplace page links to your repository. `vsce` also rewrites the relative links in `README.md` (such as `docs/PALETTE.md`) into GitHub URLs.

```sh
cd /path/to/Godhuli
git init
git add .
git commit -m "Godhuli 0.2.0"
# create an empty repo named godhuli-theme on github.com, then:
git remote add origin https://github.com/<your-github-name>/godhuli-theme.git
git branch -M main
git push -u origin main
```

### 0.2 Replace the placeholders in `package.json`

| Field | Placeholder | Replace with |
|---|---|---|
| `publisher` | `your-publisher-id` | The publisher ID you create in step 2 |
| `repository.url` | `https://github.com/your-name/godhuli-theme.git` | Your repo URL |
| `bugs.url` | `…/issues` | Your repo URL + `/issues` |
| `homepage` | `…#readme` | Your repo URL + `#readme` |

Replace `your-name` in the commented screenshot link in `README.md` too.

### 0.3 (Strongly recommended) Icon and screenshots

- **Icon:** a PNG of at least 128×128 (256×256 is ideal) saved as `icon.png` in the project root. Add `"icon": "icon.png"` to `package.json`. SVG is **not** accepted. The README describes the intended design.
- **Screenshots:** themes sell on screenshots.
  1. Open `preview/preview.tsx` in each flavor and take a screenshot.
  2. Save them as `images/dark.png` and so on, then commit and push.
  3. Reference them in `README.md` by full HTTPS URL, for example `https://raw.githubusercontent.com/<you>/godhuli-theme/main/images/dark.png`.

  README images must be HTTPS, and SVG images are rejected unless they come from a trusted badge provider.
- Add `images/` to `.vscodeignore` so the screenshots stay out of the `.vsix`. The README loads them from GitHub.

---

## 1. Create an Azure DevOps Personal Access Token (PAT)

The Marketplace authenticates through Azure DevOps.

1. Go to <https://dev.azure.com> and sign in with a Microsoft account. If asked, create an organization; any name works.
2. Click your **profile icon** (top right) → **User settings** → **Personal access tokens** → **+ New Token**.
3. Fill in the form:
   - **Name:** `vsce`
   - **Organization:** **All accessible organizations**. This setting is important: choosing a single organization causes a 401 error later.
   - **Expiration:** up to 1 year. Note the date.
   - **Scopes:** choose **Custom defined**, click **Show all scopes**, find **Marketplace** and tick **Manage**.
4. Click **Create** and **copy the token now**. It's shown only once. Store it in a password manager.

---

## 2. Create your publisher

1. Go to <https://marketplace.visualstudio.com/manage> and sign in with the **same** Microsoft account.
2. Click **Create publisher**.
   - **ID:** lowercase and permanent, for example `godhuli` or `yourname`. Your extension ID becomes `<publisher-id>.godhuli-theme`.
   - **Name:** the display name shown on the listing.
3. Save. Then put this exact ID into `package.json` → `"publisher"`.

---

## 3. Build, check and package locally

```sh
npm run build      # tokens → themes
npm run check      # must say "All checks passed."
npm run package    # runs vscode:prepublish (build + check), then writes godhuli-theme-0.2.0.vsix
```

Test the exact file you're about to ship:

```sh
code --install-extension godhuli-theme-0.2.0.vsix
```

Reload VS Code, run **Preferences: Color Theme**, and try all four flavors.

To see which files go into the package (`themes/`, README, CHANGELOG, LICENSE and package.json; **not** `tokens/` or `scripts/`):

```sh
npx @vscode/vsce ls
```

---

## 4. Publish to the VS Code Marketplace

```sh
npx @vscode/vsce login <publisher-id>   # paste the PAT when asked; stored locally
npm run publish:vscode                  # = vsce publish
```

**Alternative (no command line):** on <https://marketplace.visualstudio.com/manage>, open your publisher, click **New extension → Visual Studio Code**, and upload the `.vsix` from step 3.

After publishing, the Marketplace runs a verification scan, which usually takes about 5–10 minutes. Then the listing goes live at:

```
https://marketplace.visualstudio.com/items?itemName=<publisher-id>.godhuli-theme
```

Anyone can then install it from the Extensions view by searching for **Godhuli**, or with `code --install-extension <publisher-id>.godhuli-theme`.

---

## 5. Publish to Open VSX (Cursor, VSCodium, Windsurf…)

One-time setup:

1. Go to <https://open-vsx.org> and **Log in with GitHub**.
2. Open your avatar → **Settings** and link an **Eclipse Foundation account**. Create one at eclipse.org if needed, using the same email.
3. On the same page, sign the **Publisher Agreement**.
4. Go to **Settings → Access Tokens → Generate New Token** and copy it.
5. Create your namespace. It must equal your `publisher` field:

   ```sh
   npx ovsx create-namespace <publisher-id> -p <open-vsx-token>
   ```

Publish the same `.vsix` you tested:

```sh
npx ovsx publish godhuli-theme-0.2.0.vsix -p <open-vsx-token>
```

Instead of passing `-p`, you can set the token as `export OVSX_PAT=<token>` and run `npm run publish:ovsx`.

New namespaces show an "unverified" badge. To get verified, use the namespace ownership claim on the Open VSX GitHub issues page. This is optional.

---

## 6. Releasing updates

1. Change `tokens/…`, then run `npm run build && npm run check`.
2. Add an entry at the top of `CHANGELOG.md`. It's shown on the Marketplace **Changelog** tab.
3. Bump the version and publish. `vsce` can bump the version for you:

   ```sh
   npx @vscode/vsce publish patch   # 0.2.0 → 0.2.1  (color fixes)
   npx @vscode/vsce publish minor   # 0.2.0 → 0.3.0  (new flavor / feature)
   ```

   This edits `package.json` and, inside a git repo, creates a commit and tag.
4. Package and push the same version to Open VSX:

   ```sh
   npm run package
   npx ovsx publish godhuli-theme-<new-version>.vsix -p <token>
   ```

5. Push to GitHub: `git push --follow-tags`.

A version number can only be published **once** per registry. If something is wrong, publish a new patch version. Use `npx @vscode/vsce unpublish <publisher-id>.godhuli-theme` only as a last resort, because it removes the listing and its install count.

---

## 7. Troubleshooting

| Error | Cause → fix |
|---|---|
| `401 Unauthorized` / `Failed request: (401)` | The PAT was created for a single organization or without **Marketplace → Manage**. Create a new one with **All accessible organizations**. |
| `The Personal Access Token verification has failed` | The PAT expired. Create a new one, then run `vsce login <publisher-id>` again. |
| `Publisher 'x' not found` / `Access denied` | `package.json` → `publisher` doesn't exactly match your publisher ID, or you're logged in as a different account. |
| `Extension name already exists` | Another extension already uses this `name` or display name. Change `name` (and `displayName` if needed). |
| `Images in README.md must come from an HTTPS source` / `SVGs are restricted` | Use HTTPS PNG/JPG URLs (see 0.3). |
| `A 'repository' field is missing` (warning) | Fill in `repository` (see 0.2). You can continue by answering `y`. |
| `Make sure to edit the README.md file before you package` | Only happens with the template README. Not an issue here. |
| `vscode:prepublish` fails | `bun` isn't on PATH, or `npm run check` failed. Fix the reported gate, or change the script to `npm run build && npm run check`. |
| Open VSX: `Unknown publisher` / namespace error | Run `ovsx create-namespace` first and sign the Publisher Agreement. |

---

## Checklist before every release

- [ ] `npm run check` says **All checks passed**
- [ ] `CHANGELOG.md` has a new entry and `version` is bumped
- [ ] `publisher`, `repository`, `bugs` and `homepage` are real (no `your-…` placeholders)
- [ ] `icon.png` exists and is set in `package.json`
- [ ] Screenshots are linked by HTTPS
- [ ] The `.vsix` was installed locally and all four flavors were checked
