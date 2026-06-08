import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

const TIME_ZONE = 'Europe/Paris'

type DayBounds = {
  dayKey: string
  start: Date
  end: Date
}

type CaisseTotals = {
  totalTtcCents: number
  totalHtCents: number
  tvaCents: number
  especesCents: number
  cbCents: number
  chequesCents: number
  margeCents: number
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
            totalTtcCents: closedDay.totalTtcCents,
            totalHtCents: closedDay.totalHtCents,
            tvaCents: closedDay.tvaCents,
            especesCents: closedDay.especesCents,
            cbCents: closedDay.cbCents,
            chequesCents: closedDay.chequesCents,
            margeCents: closedDay.margeCents,
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
      throw new BadRequestException('La journée de caisse est déjà clôturée')
    }

    const totals = await this.calculateTotals(bounds)

    return this.prisma.journeeCaisse.create({
      data: {
        date: bounds.start,
        totalTtcCents: totals.totalTtcCents,
        totalHtCents: totals.totalHtCents,
        tvaCents: totals.tvaCents,
        especesCents: totals.especesCents,
        cbCents: totals.cbCents,
        chequesCents: totals.chequesCents,
        margeCents: totals.margeCents,
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
          const coutUnitaireCents = ligne.article.nomen.reduce(
            (lineCost, nomenclatureLine) =>
              lineCost +
              Math.round(
                nomenclatureLine.quantite *
                  nomenclatureLine.mp.coutUnitaireCents,
              ),
            0,
          )

          return venteCost + coutUnitaireCents * ligne.quantite
        }, 0)

        return {
          totalTtcCents: totals.totalTtcCents + vente.totalTtcCents,
          totalHtCents: totals.totalHtCents + vente.totalHtCents,
          tvaCents: totals.tvaCents + vente.tvaCents,
          especesCents:
            totals.especesCents +
            (vente.mode === 'especes' ? vente.totalTtcCents : 0),
          cbCents:
            totals.cbCents + (vente.mode === 'cb' ? vente.totalTtcCents : 0),
          chequesCents:
            totals.chequesCents +
            (vente.mode === 'cheque' ? vente.totalTtcCents : 0),
          margeCents: totals.margeCents + (vente.totalHtCents - coutMatieres),
          nbVentes: totals.nbVentes + 1,
        }
      },
      {
        totalTtcCents: 0,
        totalHtCents: 0,
        tvaCents: 0,
        especesCents: 0,
        cbCents: 0,
        chequesCents: 0,
        margeCents: 0,
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
