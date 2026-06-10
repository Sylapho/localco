import { IsIn } from 'class-validator'

export const COMMANDE_STATUTS = [
  'nouvelle',
  'preparee',
  'traitee',
  'annulee',
] as const

export type CommandeStatut = (typeof COMMANDE_STATUTS)[number]

export class UpdateCommandeStatutDto {
  @IsIn(COMMANDE_STATUTS)
  statut!: CommandeStatut
}
