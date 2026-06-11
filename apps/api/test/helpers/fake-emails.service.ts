type SentOrderConfirmation = {
  id: number
  email: string
}

export class FakeEmailsService {
  readonly sentOrderConfirmations: SentOrderConfirmation[] = []
  failNextConfirmation = false

  reset() {
    this.sentOrderConfirmations.length = 0
    this.failNextConfirmation = false
  }

  sendOrderConfirmation(order: SentOrderConfirmation) {
    if (this.failNextConfirmation) {
      this.failNextConfirmation = false
      return Promise.reject(new Error('E2E email failure'))
    }

    this.sentOrderConfirmations.push({
      id: order.id,
      email: order.email,
    })

    return Promise.resolve()
  }
}
