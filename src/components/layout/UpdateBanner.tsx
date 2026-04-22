import { useEffect, useState } from "react";
import { Box, Button, Text } from "@primer/react";
import { DownloadIcon, SyncIcon, XIcon } from "@primer/octicons-react";

/**
 * UpdateBanner — surfaces electron-updater state to the user.
 *
 * Subscribes to the `updater:status` IPC stream wired in `electron/main.ts`.
 * Renders a small banner at the top of the app when there's something
 * interesting to show:
 *   - "available"  → offers a Download button
 *   - "downloading" → shows a progress %
 *   - "downloaded" → offers Install & restart (Windows) or Open download
 *                    page (macOS, because unsigned builds can't quitAndInstall)
 *   - "error"      → shows the message, dismissable
 *
 * In dev (`window.electronAPI` undefined), the component renders nothing.
 * A user can also dismiss the banner — we track that locally so the
 * same status doesn't re-prompt until a new update event arrives.
 */

type UpdaterStatus =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; version?: string }
  | { status: "not-available" }
  | { status: "downloading"; percent: number }
  | { status: "downloaded"; version?: string; downloadedFile?: string | null }
  | { status: "error"; message: string };

export function UpdateBanner() {
  const [status, setStatus] = useState<UpdaterStatus>({ status: "idle" });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const api = window.electronAPI?.updater;
    if (!api) return; // Dev / web preview: no electron IPC

    // Pull the current state once on mount (we might have missed the
    // initial `checking-for-update` event if the subscription was set
    // up after the main process already fired it).
    api.getState().then((s) => setStatus(s)).catch(() => {});

    // Any new status event from the main process clears the "dismissed"
    // flag so the user sees the next milestone (e.g. download complete
    // after they dismissed "update available").
    const unsubscribe = api.onStatus((s) => {
      setStatus(s);
      setDismissed(false);
    });
    return unsubscribe;
  }, []);

  if (dismissed) return null;

  const api = window.electronAPI?.updater;
  if (!api) return null;

  // macOS can't auto-install without an Apple Developer ID (Squirrel
  // rejects the swap when old/new code signatures don't match, which
  // is always the case for ad-hoc builds). We surface the limitation
  // in the UI and steer users to the manual drag-and-drop flow.
  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

  if (status.status === "available") {
    return (
      <Banner tone="info" onDismiss={() => setDismissed(true)}>
        <Text sx={{ fontWeight: "bold" }}>
          Version {status.version ?? "—"} available
        </Text>
        <Button
          size="small"
          leadingVisual={DownloadIcon}
          onClick={() => api.downloadUpdate()}
        >
          Download
        </Button>
      </Banner>
    );
  }

  if (status.status === "downloading") {
    const pct = Math.max(0, Math.min(100, Math.round(status.percent)));
    return (
      <Banner tone="info">
        <Text>Downloading update… {pct}%</Text>
      </Banner>
    );
  }

  if (status.status === "downloaded") {
    if (isMac) {
      return (
        <Banner tone="success">
          <Text sx={{ fontWeight: "bold" }}>
            Version {status.version ?? "—"} downloaded
          </Text>
          <Text sx={{ fontSize: 0, color: "fg.muted" }}>
            Drag the new Fino.app into /Applications to install.
          </Text>
          <Button
            size="small"
            variant="primary"
            leadingVisual={DownloadIcon}
            onClick={() => api.installUpdate()}
          >
            Open download
          </Button>
        </Banner>
      );
    }
    return (
      <Banner tone="success">
        <Text sx={{ fontWeight: "bold" }}>
          Version {status.version ?? "—"} ready
        </Text>
        <Button
          size="small"
          variant="primary"
          leadingVisual={SyncIcon}
          onClick={() => api.installUpdate()}
        >
          Install & restart
        </Button>
      </Banner>
    );
  }

  if (status.status === "error") {
    // If an install failed, give the user an escape hatch to grab the
    // update manually from the GitHub Release page.
    return (
      <Banner tone="danger" onDismiss={() => setDismissed(true)}>
        <Text>Updater error: {status.message}</Text>
        <Button
          size="small"
          leadingVisual={DownloadIcon}
          onClick={() => api.openManualDownload()}
        >
          Open download page
        </Button>
      </Banner>
    );
  }

  // "idle", "checking", "not-available" → stay silent
  return null;
}

// ---- Banner shell ---------------------------------------------------------

function Banner({
  tone,
  children,
  onDismiss,
}: {
  tone: "info" | "success" | "danger";
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  const bg =
    tone === "info" ? "accent.subtle" : tone === "success" ? "success.subtle" : "danger.subtle";
  const border =
    tone === "info" ? "accent.emphasis" : tone === "success" ? "success.emphasis" : "danger.emphasis";

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 3,
        px: 3,
        py: 2,
        bg,
        borderBottomWidth: 1,
        borderBottomStyle: "solid",
        borderBottomColor: border,
        fontSize: 1,
      }}
    >
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 3 }}>
        {children}
      </Box>
      {onDismiss && (
        <Button
          size="small"
          variant="invisible"
          leadingVisual={XIcon}
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          {""}
        </Button>
      )}
    </Box>
  );
}
