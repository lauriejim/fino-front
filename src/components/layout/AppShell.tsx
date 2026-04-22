import { Box, Heading, ActionMenu, ActionList, Text } from "@primer/react";
import { Outlet } from "react-router-dom";
import { PersonIcon, SignOutIcon } from "@primer/octicons-react";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar } from "./Sidebar";

const SIDEBAR_WIDTH = 260;
const HEADER_HEIGHT = 48;

export function AppShell() {
  const { user, logout } = useAuth();

  const displayName = user
    ? [user.firstname, user.lastname].filter(Boolean).join(" ") || user.username || user.email
    : "";

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <Box
        as="header"
        sx={{
          height: HEADER_HEIGHT,
          borderBottomWidth: 1,
          borderBottomStyle: "solid",
          borderBottomColor: "border.default",
          bg: "canvas.subtle",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 3,
          flexShrink: 0,
        }}
      >
        <Heading as="h1" sx={{ fontSize: 2, fontWeight: "bold" }}>
          Fino
        </Heading>

        {user && (
          <ActionMenu>
            <ActionMenu.Button variant="invisible" leadingVisual={PersonIcon}>
              <Text sx={{ fontSize: 1 }}>{displayName}</Text>
            </ActionMenu.Button>
            <ActionMenu.Overlay width="medium">
              <ActionList>
                <ActionList.Item onSelect={() => logout()}>
                  <ActionList.LeadingVisual>
                    <SignOutIcon />
                  </ActionList.LeadingVisual>
                  Sign out
                </ActionList.Item>
              </ActionList>
            </ActionMenu.Overlay>
          </ActionMenu>
        )}
      </Box>

      {/* Body: sidebar + main */}
      <Box sx={{ flex: 1, display: "flex", minHeight: 0 }}>
        <Box
          as="nav"
          sx={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            borderRightWidth: 1,
            borderRightStyle: "solid",
            borderRightColor: "border.default",
            bg: "canvas.subtle",
            overflowY: "auto",
            p: 2,
          }}
        >
          <Sidebar />
        </Box>

        <Box
          as="main"
          sx={{
            flex: 1,
            overflow: "auto",
            bg: "canvas.default",
            p: 4,
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
