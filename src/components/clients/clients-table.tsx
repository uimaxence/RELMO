"use client";

import { useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClientStatusBadge } from "@/components/status-badge";
import { ConfirmDelete } from "@/components/forms/confirm-delete";
import { deleteClient } from "@/app/actions/clients";
import { ClientPanel, type PanelClient } from "@/components/clients/client-panel";
import { euros } from "@/lib/format";

// Une ligne = un client. Le clic ouvre la fiche consolidée (sites, contrats,
// factures, devis) au lieu de disperser la navigation sur plusieurs pages.
export function ClientsTable({ clients }: { clients: PanelClient[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = clients.find((c) => c.id === selectedId) ?? null;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="text-center">Sites</TableHead>
            <TableHead className="text-right">MRR facturé</TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((c) => (
            <TableRow
              key={c.id}
              tabIndex={0}
              aria-label={`Ouvrir la fiche de ${c.nom}`}
              onClick={() => setSelectedId(c.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedId(c.id);
                }
              }}
              className="cursor-pointer focus-visible:bg-muted focus-visible:outline-none"
            >
              <TableCell className="font-medium">
                <span className="inline-flex items-center gap-2">
                  {c.nom}
                  <ClientStatusBadge statut={c.statut} />
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {c.email ?? ""}
              </TableCell>
              <TableCell className="text-center">{c.sites.length}</TableCell>
              <TableCell className="text-right">
                <div className="font-mono font-medium tabular-nums">
                  {euros(c.mrrFacture)}
                </div>
                {c.mrrEnAttente > 0 ? (
                  <div className="font-mono text-xs tabular-nums text-warning-ink">
                    {euros(c.mrrEnAttente)} en attente
                  </div>
                ) : null}
                {c.mrrAVenir > 0 ? (
                  <div className="font-mono text-xs tabular-nums text-muted-foreground">
                    {euros(c.mrrAVenir)} à venir
                  </div>
                ) : null}
              </TableCell>
              <TableCell
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <div className="flex justify-end">
                  <ConfirmDelete
                    action={deleteClient.bind(null, c.id)}
                    description={`Supprimer « ${c.nom} » et tous ses sites, contrats et livrables ? Cette action est irréversible.`}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ClientPanel
        client={selected}
        open={selected !== null}
        onOpenChange={(o) => {
          if (!o) setSelectedId(null);
        }}
      />
    </>
  );
}
