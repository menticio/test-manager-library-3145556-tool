// Manager Library demo seeder (T-21). Node.js 22, no dependencies. Uses ONLY the API (data-model.md §9: never SQL).
//
//   node seed.mjs past      with the API started with CLOCK_OFFSET_DAYS=-20: 40 books, 10 members, 5 loans
//                           (3 stay unreturned and will be overdue, 2 are returned)
//   node seed.mjs present   with the API back at CLOCK_OFFSET_DAYS=0: 10 more loans (15 in total), checks the result
//
// Environment: API_URL (default http://localhost:8000/api/v1), ADMIN_USERNAME, ADMIN_PASSWORD. Nothing secret is printed.

const API = process.env.API_URL ?? 'http://localhost:8000/api/v1'
const phase = process.argv[2]
const DAY = 86_400_000

const CATEGORIES = {
  Novela: ['Cien años de soledad', 'La vorágine', 'María', 'El amor en los tiempos del cólera', 'Rayuela', 'Pedro Páramo', 'La casa de los espíritus', 'Ficciones'],
  Ciencia: ['Breve historia del tiempo', 'El origen de las especies', 'Cosmos', 'El gen egoísta', 'Los tres primeros minutos', 'La doble hélice', 'El universo elegante', 'Sapiens'],
  Tecnología: ['Código limpio', 'El programador pragmático', 'Patrones de diseño', 'Domain-Driven Design', 'Refactorización', 'Arquitectura limpia', 'Desarrollo guiado por pruebas', 'Estructuras de datos'],
  Historia: ['Las venas abiertas de América Latina', 'Historia de Colombia', 'La Segunda Guerra Mundial', 'Los incas', 'La Revolución francesa', 'Breve historia de Roma', 'El siglo de los genocidios', 'Bolívar'],
  Infantil: ['El principito', 'Alicia en el país de las maravillas', 'Pinocho', 'Matilda', 'Charlie y la fábrica de chocolate', 'Momo', 'La historia interminable', 'Rin Rin Renacuajo'],
}
const MEMBERS = ['Laura Gómez', 'Pedro Ruiz', 'Ana Torres', 'Carlos Pérez', 'Sofía Ramírez', 'Andrés López', 'Valentina Díaz', 'Juan Martínez', 'Camila Rojas', 'Mateo Herrera']

function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

let token = null

async function call(method, path, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(`${method} ${path} → ${response.status} ${data?.code ?? ''}: ${data?.message ?? ''}`)
    error.code = data?.code
    throw error
  }
  return data
}

/** Logs in and returns the API clock (the token's iat), so the phase can check the clock offset without an extra endpoint. */
async function login() {
  const { ADMIN_USERNAME: username, ADMIN_PASSWORD: password } = process.env
  if (!username || !password) fail('Defina ADMIN_USERNAME y ADMIN_PASSWORD (los mismos de infra/.env).')
  const result = await call('POST', '/auth/login', { username, password })
  if (result.role !== 'admin') fail('El sembrador necesita el usuario admin.')
  token = result.access_token
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
  return claims.iat * 1000
}

const lend = (memberId, bookIds) => call('POST', '/loans', { member_id: memberId, items: bookIds.map((id) => ({ book_id: id })) })
const returnAll = (loan) => Promise.all(loan.items.map((item) => call('POST', `/loans/${loan.id}/items/${item.id}/return`)))

async function catalog() {
  const books = []
  for (let page = 1; ; page++) {
    const result = await call('GET', `/books?size=50&page=${page}`)
    books.push(...result.items)
    if (books.length >= result.total) return books.sort((a, b) => a.isbn.localeCompare(b.isbn))
  }
}

async function members() {
  return (await call('GET', '/members?size=50')).items.sort((a, b) => a.document_number.localeCompare(b.document_number))
}

async function past() {
  const apiNow = await login()
  const daysBehind = Math.round((Date.now() - apiNow) / DAY)
  if (daysBehind < 15) fail(`La API no está en el pasado (desfase ${daysBehind} días). Arránquela con CLOCK_OFFSET_DAYS=-20.`)
  if ((await call('GET', '/books?size=1')).total > 0) fail('La base ya tiene libros: el sembrador espera una base recién creada.')

  const categories = Object.fromEntries((await call('GET', '/categories')).items.map((c) => [c.name, c.id]))
  let n = 0
  for (const [category, titles] of Object.entries(CATEGORIES)) {
    for (const title of titles) {
      n++
      await call('POST', '/books', {
        title, author: `Autor ${n}`, isbn: `978${String(n).padStart(10, '0')}`, category_id: categories[category], total_copies: 1 + (n % 4),
      })
    }
  }
  for (const [i, full_name] of MEMBERS.entries()) {
    await call('POST', '/members', { full_name, document_number: `90000000${String(i + 1).padStart(2, '0')}` })
  }

  const books = await catalog()
  const people = await members()
  // 3 loans that stay unreturned: due 14 days after a date 20 days ago, so they are overdue today.
  for (let i = 0; i < 3; i++) await lend(people[i].id, [books[i * 8].id])
  // 2 loans returned in the past, for the report history.
  for (let i = 3; i < 5; i++) await returnAll(await lend(people[i].id, [books[0].id, books[17].id]))

  console.log(`✓ Fase pasado: ${books.length} libros, ${people.length} socios, 5 préstamos (3 quedarán vencidos).`)
}

async function present() {
  const apiNow = await login()
  if (Math.abs(Date.now() - apiNow) > DAY) fail('La API sigue desplazada. Arránquela con CLOCK_OFFSET_DAYS=0.')

  const books = await catalog()
  const people = await members()
  if (books.length < 40 || people.length < 10) fail('Corra primero la fase "past".')

  // Members 1-3 have overdue books: the API must refuse them (RN-3).
  try {
    await lend(people[0].id, [books[30].id])
    fail('La API debía rechazar a un socio con vencidos.')
  } catch (e) {
    if (e.code !== 'MEMBER_HAS_OVERDUE') throw e
  }

  // 10 loans for members 4-10: popular books (4 copies each: positions 2, 6, 10…) repeat so the report has a ranking.
  // No member goes over 3 books not returned (RN-2) and no book is lent beyond its copies (RN-1).
  const plan = [[3, [2, 6]], [4, [2]], [5, [6, 10]], [6, [2, 14]], [7, [6]], [8, [10]], [9, [2, 18]], [3, [22]], [4, [26]], [5, [30]]]
  const loans = []
  for (const [member, picks] of plan) loans.push(await lend(people[member].id, picks.map((p) => books[p].id)))
  for (const loan of loans.slice(0, 4)) await returnAll(loan)

  const overdue = (await call('GET', '/loans/overdue')).items
  const today = new Date().toISOString().slice(0, 10)
  const monthAgo = new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10)
  const report = await call('GET', `/reports/most-borrowed?from=${monthAgo}&to=${today}`)
  const totalLoans = (await call('GET', '/loans?size=1')).total

  console.log(`✓ Fase presente: ${loans.length} préstamos nuevos (${totalLoans} en total).`)
  console.log(`✓ /loans/overdue devuelve ${overdue.length} líneas: ${overdue.map((o) => `${o.book_title} (${o.days_late} días)`).join(', ')}`)
  console.log(`✓ Reporte ${monthAgo} a ${today}: ${report.rows.length} filas; primero «${report.rows[0]?.book_title}» con ${report.rows[0]?.times_borrowed} préstamos.`)
  if (overdue.length !== 3 || report.rows.length === 0) fail('El resultado no coincide con la evidencia de T-21.')
}

if (phase === 'past') await past().catch((e) => fail(e.message))
else if (phase === 'present') await present().catch((e) => fail(e.message))
else fail('Uso: node seed.mjs past | present')
