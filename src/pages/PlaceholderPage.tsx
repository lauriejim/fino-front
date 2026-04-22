import { Box, Heading, Text } from "@primer/react";

interface PlaceholderPageProps {
  title: string;
  message?: string;
}

// Stubs for screens that haven't been migrated yet (Supports, Arbitrage,
// Import, About). Keeps the nav functional while we iterate.
export function PlaceholderPage({ title, message }: PlaceholderPageProps) {
  return (
    <Box>
      <Heading as="h2" sx={{ fontSize: 4, mb: 2 }}>
        {title}
      </Heading>
      <Text sx={{ color: "fg.muted" }}>
        {message ?? "Not yet migrated from v1 — coming in a later iteration."}
      </Text>
    </Box>
  );
}
