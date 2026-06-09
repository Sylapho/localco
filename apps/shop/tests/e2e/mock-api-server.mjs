import http from 'node:http'

const port = Number(process.env.PLAYWRIGHT_MOCK_API_PORT ?? 4010)

const articles = [
  {
    id: 1,
    nom: 'Terrine de volaille',
    prixCents: 650,
    tvaBps: 550,
    stock: 4,
    online: true,
    imageUrl: null,
    description: 'Terrine artisanale pour un retrait local.',
    ingredients: 'Volaille, sel, poivre',
    allergenes: null,
  },
  {
    id: 2,
    nom: 'Saucisse de poulet',
    prixCents: 480,
    tvaBps: 550,
    stock: 8,
    online: true,
    imageUrl: null,
    description: 'Preparation maison.',
    ingredients: 'Poulet',
    allergenes: null,
  },
]

const pickupPoints = [
  {
    label: 'Marche de Gaillon',
    schedule: 'Mardi matin, 8h-12h',
    allowedWeekdays: [2],
    value: 'Marche de Gaillon - Mardi matin, 8h-12h',
  },
]

let lastCheckoutPayload = null

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': 'application/json',
  })
  response.end(JSON.stringify(payload))
}

function sendText(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': 'text/plain; charset=utf-8',
  })
  response.end(payload)
}

async function readJsonBody(request) {
  const chunks = []

  for await (const chunk of request) {
    chunks.push(chunk)
  }

  const rawBody = Buffer.concat(chunks).toString('utf8')

  return rawBody ? JSON.parse(rawBody) : null
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`)

  if (request.method === 'OPTIONS') {
    sendText(response, 204, '')
    return
  }

  if (request.method === 'GET' && url.pathname === '/__mock/health') {
    sendJson(response, 200, { ok: true })
    return
  }

  if (request.method === 'POST' && url.pathname === '/__mock/reset') {
    lastCheckoutPayload = null
    sendJson(response, 200, { ok: true })
    return
  }

  if (request.method === 'GET' && url.pathname === '/__mock/last-checkout') {
    sendJson(response, 200, { payload: lastCheckoutPayload })
    return
  }

  if (request.method === 'GET' && url.pathname === '/api/boutique/articles') {
    sendJson(response, 200, articles)
    return
  }

  if (
    request.method === 'GET' &&
    url.pathname === '/api/commandes/pickup-points'
  ) {
    sendJson(response, 200, pickupPoints)
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/commandes/checkout') {
    lastCheckoutPayload = await readJsonBody(request)
    sendJson(response, 201, {
      url: `http://127.0.0.1:${port}/stripe/checkout-session`,
    })
    return
  }

  if (request.method === 'GET' && url.pathname === '/stripe/checkout-session') {
    sendText(response, 200, 'Stripe checkout mock')
    return
  }

  sendJson(response, 404, { message: 'Not found' })
})

server.listen(port, '127.0.0.1')
