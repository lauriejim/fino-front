import { useEffect, type ReactNode } from "react";
import { Box, Heading, IconButton, Text } from "@primer/react";
import { XIcon } from "@primer/octicons-react";

interface ModalProps {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** max-width of the inner card. Defaults to 1200px. */
  maxWidth?: string | number;
}

/**
 * Lightweight modal built on Primer Box.
 * Replaces Primer's Dialog because its API across v36/v37 is inconsistent
 * and we want full control over styling + behavior.
 *
 * Behavior:
 *   - Fixed full-viewport backdrop (50% black)
 *   - Click outside the card → onClose
 *   - Escape key → onClose
 *   - Body scroll locked while open
 *   - Internal scroll on the body if content overflows 90vh
 */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  maxWidth = "1200px",
}: ModalProps) {
  // Lock body scroll while the modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Close on Escape — capture phase so Primer components (DataTable, TextInput)
  // can't swallow the key before we see it.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [onClose]);

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        bg: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        p: 4,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth,
          maxHeight: "90vh",
          bg: "canvas.default",
          borderRadius: 2,
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "border.default",
          boxShadow: "shadow.large",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            p: 3,
            borderBottomWidth: 1,
            borderBottomStyle: "solid",
            borderBottomColor: "border.default",
          }}
        >
          <Box>
            <Heading as="h3" sx={{ fontSize: 3, mb: subtitle ? 1 : 0 }}>
              {title}
            </Heading>
            {subtitle && (
              <Text sx={{ color: "fg.muted", fontSize: 1 }}>{subtitle}</Text>
            )}
          </Box>
          <IconButton
            icon={XIcon}
            aria-label="Close"
            variant="invisible"
            onClick={onClose}
          />
        </Box>

        <Box sx={{ p: 3, overflow: "auto" }}>{children}</Box>
      </Box>
    </Box>
  );
}
