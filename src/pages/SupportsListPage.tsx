import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Flash,
  FormControl,
  Heading,
  Spinner,
  Text,
  TextInput,
} from "@primer/react";
import { DataTable, Table } from "@primer/react/experimental";
import { PlusIcon, SearchIcon } from "@primer/octicons-react";
import { createSupport, listSupports } from "@/api/supports";
import type { Support } from "@/types/strapi";
import { Modal } from "@/components/modal/Modal";

export function SupportsListPage() {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const query = useQuery({
    queryKey: ["supports", "list"],
    queryFn: listSupports,
  });

  const filtered = useMemo(() => {
    const data = query.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.ISIN ?? "").toLowerCase().includes(q) ||
        (s.code ?? "").toLowerCase().includes(q)
    );
  }, [query.data, search]);

  return (
    <Box>
      <Box
        sx={{
          mb: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Heading as="h2" sx={{ fontSize: 4, mb: 1 }}>
            Supports
          </Heading>
          <Text sx={{ color: "fg.muted", fontSize: 1 }}>
            {query.data ? `${query.data.length} total` : "…"}
          </Text>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <TextInput
            leadingVisual={SearchIcon}
            placeholder="Search supports…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ width: "280px" }}
          />
          <Button
            leadingVisual={PlusIcon}
            variant="primary"
            onClick={() => setCreating(true)}
          >
            Add support
          </Button>
        </Box>
      </Box>

      {query.isError && (
        <Flash variant="danger" sx={{ mb: 3 }}>
          Failed to load supports: {(query.error as Error).message}
        </Flash>
      )}

      {query.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
          <Spinner />
        </Box>
      ) : filtered.length === 0 ? (
        <Box sx={{ p: 3, bg: "canvas.subtle", borderRadius: 2 }}>
          <Text sx={{ color: "fg.muted", fontSize: 1 }}>
            {search.trim() ? "No supports match your search." : "No supports yet."}
          </Text>
        </Box>
      ) : (
        <Table.Container>
          <DataTable<Support>
            aria-label="Supports"
            data={filtered}
            columns={[
              {
                header: "ISIN",
                field: "ISIN",
                rowHeader: true,
                renderCell: (row) => (
                  <Text sx={{ fontFamily: "mono" }}>{row.ISIN ?? "—"}</Text>
                ),
              },
              {
                header: "Name",
                field: "name",
                renderCell: (row) => row.name,
              },
            ]}
          />
        </Table.Container>
      )}

      {creating && <CreateSupportModal onClose={() => setCreating(false)} />}
    </Box>
  );
}

// ---- Create modal ---------------------------------------------------------

function CreateSupportModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [isin, setIsin] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createSupport({
        name: name.trim(),
        ISIN: isin.trim() || null,
        // `code` is not surfaced in the form — it mirrors the ISIN so the
        // match-on-commit logic in the import pipeline (which keys by
        // support.code) keeps working.
        code: isin.trim() || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["supports"] });
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || "Create failed.");
    },
  });

  const canSubmit = name.trim().length > 0 && !mutation.isPending;

  return (
    <Modal title="New support" onClose={onClose}>
      {error && (
        <Flash variant="danger" sx={{ mb: 3 }}>
          {error}
        </Flash>
      )}

      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <FormControl>
          <FormControl.Label>ISIN</FormControl.Label>
          <TextInput
            value={isin}
            onChange={(e) => setIsin(e.target.value)}
            placeholder="e.g. FR0000120073"
            block
          />
        </FormControl>

        <FormControl required>
          <FormControl.Label>Name</FormControl.Label>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Support name"
            block
          />
        </FormControl>
      </Box>

      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 2,
          mt: 4,
        }}
      >
        <Button onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => mutation.mutate()}
          disabled={!canSubmit}
        >
          {mutation.isPending ? "Creating…" : "Create"}
        </Button>
      </Box>
    </Modal>
  );
}
