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
  paiement_en_attente: 'bg-gray-100 text-gray-800',
  nouvelle: 'bg-amber-100 text-amber-800',
  preparee: 'bg-blue-100 text-blue-800',
  traitee: 'bg-green-100 text-green-800',
  annulee: 'bg-red-100 text-red-800',
  paiement_a_verifier: 'bg-purple-100 text-purple-800',
}

export default function CommandeStatusBadge({
  statut,
}: {
  statut: CommandeStatut
}) {
  return (
    <span
      className={`rounded px-2 py-1 text-xs font-semibold ${commandeStatusClasses[statut]}`}
    >
      {commandeStatusLabels[statut]}
    </span>
  )
}
