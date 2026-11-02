# Test suites

Run npm run build before production browser and server checks. Run the active browser suite with FRAMESCRIPT_TEST_PRODUCTION=1 and npm run test:e2e. Playwright collects only *.spec.ts.

Files ending in .legacy.ts preserve browser scenarios for the former AI assistant, Services and storyboard interface. Those controls are hidden in the current manual editor, so these files are intentionally outside browser discovery. They are historical reference, not passing coverage. Provider, authentication, workflow timing and audio composition logic remain covered by unit and integration suites.

Active browser tests cover manual code editing, project persistence/recovery, media import, audio editing, typography, prompts, timeline interactions, layout and exports. Server and rendering checks use isolated test data; they do not use the live workspace.
