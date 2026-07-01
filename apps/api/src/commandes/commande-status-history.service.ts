import { Injectable } from '@nestjs/common'

type StatusHistoryTransaction = {
  commandeStatutHistorique: {
    create: (args: {
      data: {
        commandeId: number
        ancienStatut?: string | null
        nouveauStatut: string
        motif?: string
        createdByUserId?: string
      }
    }) => Promise<unknown>
  }
}

type StatusHistoryData = {
  commandeId: number
  ancienStatut?: string | null
  nouveauStatut: string
  motif?: string
  createdByUserId?: string
}

@Injectable()
export class CommandeStatusHistoryService {
  async record(tx: StatusHistoryTransaction, data: StatusHistoryData) {
    await tx.commandeStatutHistorique.create({
      data,
    })
  }
}
