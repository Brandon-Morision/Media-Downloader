# Release & Git Push Standard Operating Procedure

Whenever the user instructs to push to Git or release:
1. **Draft Release Notes**: Create/update `RELEASE_NOTES_v<version>.md` detailing all new features, fixes, and architectural improvements.
2. **Commit & Push to GitHub**:
   - Ensure frontend bundle is built (`npm run build`).
   - Stage all code and release notes (`git add -A`).
   - Commit with structured message reflecting the release version.
   - Push to `origin/main` (and push tags if applicable).
3. **Run Windows Build**:
   - Execute `python build_windows.py` to compile the desktop distribution and installer.
