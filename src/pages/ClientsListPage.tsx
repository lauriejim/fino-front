import { useMemo, useState, type MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Heading,
  Text,
  TextInput,
  Spinner,
  Flash,
} from "@primer/react";
import { DataTable, Table } from "@primer/react/experimental";
import { SearchIcon } from "@primer/octicons-react";
import { listClients } from "@/api/clients";
import type { Client } from "@/types/strapi";
import {
  CLICKABLE_ROWS_SX,
  hasSelection,
  rowIndexFromClick,
} from "@/lib/clickable-rows";

export function ClientsListPage() {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ["clients", "list"],
    queryFn: () => listClients(),
  });

  const filtered = useMemo(() => {
    const data = query.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((c) => {
      const full = `${c.firstname} ${c.lastname}`.toLowerCase();
      return (
        full.includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q)
      );
    });
  }, [query.data, search]);

  function onTableClick(e: MouseEvent<HTMLElement>) {
    if (hasSelection()) return;
    const idx = rowIndexFromClick(e);
    if (idx === null) return;
    const row = filtered[idx];
    if (row) navigate(`/clients/${row.documentId}`);
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Heading as="h2" sx={{ fontSize: 4, mb: 1 }}>
            Clients
          </Heading>
          <Text sx={{ color: "fg.muted", fontSize: 1 }}>
            {query.data ? `${query.data.length} total` : "…"}
          </Text>
        </Box>

        <TextInput
          leadingVisual={SearchIcon}
          placeholder="Search clients…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: "280px" }}
        />
      </Box>

      {query.isError && (
        <Flash variant="danger" sx={{ mb: 3 }}>
          Failed to load clients: {(query.error as Error).message}
        </Flash>
      )}

      {query.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
          <Spinner />
        </Box>
      ) : (
        <Box sx={CLICKABLE_ROWS_SX} onClickCapture={onTableClick}>
          <Table.Container>
            <DataTable<Client>
              aria-labelledby="clients-heading"
              data={filtered}
              columns={[
                {
                  header: "Name",
                  field: "lastname",
                  rowHeader: true,
                  renderCell: (row) => `${row.lastname.toUpperCase()} ${row.firstname}`,
                },
                {
                  header: "Email",
                  field: "email",
                  renderCell: (row) => row.email ?? "—",
                },
                {
                  header: "Phone",
                  field: "phone",
                  renderCell: (row) => row.phone ?? "—",
                },
              ]}
            />
          </Table.Container>
        </Box>
      )}
    </Box>
  );
}
