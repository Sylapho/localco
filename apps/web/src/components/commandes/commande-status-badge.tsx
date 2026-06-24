import type { CommandeStatut } from '@/lib/api'

export const commandeStatusLabels: Record<CommandeStatut, string> = {
  paiement_en_attente: 'Paiement en attente',
  nouvelle: 'Nouvelle',
  preparee: 'Préparée',
  traitee: 'Traitée',
  annulee: 'Annulée',
  paiement_a_verifier: 'Paiement à vérifier',
}

const commandeStatusClasses: Record<CommandeStatut, string> = {
  paiement_en_attente: 'border-zinc-200 bg-zinc-100 text-zinc-700',
  nouvelle: 'border-amber-200 bg-amber-100 text-amber-800',
  preparee: 'border-blue-200 bg-blue-100 text-blue-800',
  traitee: 'border-green-200 bg-green-100 text-green-800',
  annulee: 'border-red-200 bg-red-100 text-red-800',
  paiement_a_verifier: 'border-violet-200 bg-violet-100 text-violet-800',
}

export default function CommandeStatusBadge({
  statut,
}: {
  statut: CommandeStatut
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${commandeStatusClasses[statut]}`}
    >
      {commandeStatusLabels[statut]}
    </span>
  )
}