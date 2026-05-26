import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

const TIME_ZONE = 'Europe/Paris'

type DayBounds = {
  dayKey: string
  start: Date
  end: Date
}

type CaisseTotals = {
  totalTTC: number
  totalHT: number
  tva: number
  especes: number
  cb: number
  cheques: number
  marge: number
  nbVentes: number
}

@Injectable()
export class CaisseService {
  constructor(private readonly prisma: PrismaService) {}

  findClosedDays() {
    return this.prisma.journeeCaisse.findMany({
      orderBy: {
        date: 'desc',
      },
    })
  }

  async getTodaySummary() {
    const bounds = getParisDayBounds(new Date())
    const [closedDay, totals] = await Promise.all([
      this.prisma.journeeCaisse.findUnique({
        where: {
          date: bounds.start,
        },
      }),
      this.calculateTotals(bounds),
    ])

    return {
      date: bounds.start,
      dayKey: bounds.dayKey,
      status: closedDay ? 'closed' : 'open',
      closedDay,
      totals: closedDay
        ? {
            totalTTC: closedDay.totalTTC,
            totalHT: closedDay.totalHT,
            tva: closedDay.tva,
            especes: closedDay.especes,
            cb: closedDay.cb,
            cheques: closedDay.cheques,
            marge: closedDay.marge,
            nbVentes: closedDay.nbVentes,
          }
        : totals,
    }
  }

  async closeToday() {
    const bounds = getParisDayBounds(new Date())
    const alreadyClosed = await this.prisma.journeeCaisse.findUnique({
      where: {
        date: bounds.start,
      },
    })

    if (alreadyClosed) {
      throw new BadRequestException('La journee de caisse est deja cloturee')
    }

    const totals = await this.calculateTotals(bounds)

    return this.prisma.journeeCaisse.create({
      data: {
        date: bounds.start,
        totalTTC: totals.totalTTC,
        totalHT: totals.totalHT,
        tva: totals.tva,
        especes: totals.especes,
        cb: totals.cb,
        cheques: totals.cheques,
        marge: totals.marge,
        nbVentes: totals.nbVentes,
      },
    })
  }

  private async calculateTotals(bounds: DayBounds): Promise<CaisseTotals> {
    const ventes = await this.prisma.vente.findMany({
      where: {
        date: {
          gte: bounds.start,
          lt: bounds.end,
        },
      },
      include: {
        lignes: {
          include: {
            article: {
              include: {
                nomen: {
                  include: {
                    mp: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    return ventes.reduce<CaisseTotals>(
      (totals, vente) => {
        const coutMatieres = vente.lignes.reduce((venteCost, ligne) => {
          const coutUnitaire = ligne.article.nomen.reduce(
            (lineCost, nomenclatureLine) =>
              lineCost +
              nomenclatureLine.quantite * nomenclatureLine.mp.coutUnitaire,
            0,
          )

          return venteCost + coutUnitaire * ligne.quantite
        }, 0)

        return {
          totalTTC: totals.totalTTC + vente.totalTTC,
          totalHT: totals.totalHT + vente.totalHT,
          tva: totals.tva + vente.tva,
          especes:
            totals.especes + (vente.mode === 'especes' ? vente.totalTTC : 0),
          cb: totals.cb + (vente.mode === 'cb' ? vente.totalTTC : 0),
          cheques:
            totals.cheques + (vente.mode === 'cheque' ? vente.totalTTC : 0),
          marge: totals.marge + (vente.totalHT - coutMatieres),
          nbVentes: totals.nbVentes + 1,
        }
      },
      {
        totalTTC: 0,
        totalHT: 0,
        tva: 0,
        especes: 0,
        cb: 0,
        cheques: 0,
        marge: 0,
        nbVentes: 0,
      },
    )
  }
}

function getParisDayBounds(date: Date): DayBounds {
  const parts = getTimeZoneDateParts(date, TIME_ZONE)
  const start = zonedTimeToUtc(
    parts.year,
    parts.month,
    parts.day,
    0,
    0,
    0,
    TIME_ZONE,
  )
  const end = zonedTimeToUtc(
    parts.year,
    parts.month,
    parts.day + 1,
    0,
    0,
    0,
    TIME_ZONE,
  )

  return {
    dayKey: `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(
      parts.day,
    ).padStart(2, '0')}`,
    start,
    end,
  }
}

function getTimeZoneDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(date)

  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
    day: Number(parts.find((part) => part.type === 'day')?.value),
  }
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const getPart = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value)
  const asUtc = Date.UTC(
    getPart('year'),
    getPart('month') - 1,
    getPart('day'),
    getPart('hour') % 24,
    getPart('minute'),
    getPart('second'),
  )

  return asUtc - date.getTime()
}

function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
) {
  const utcGuess = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second),
  )
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone)

  return new Date(utcGuess.getTime() - offset)
}
