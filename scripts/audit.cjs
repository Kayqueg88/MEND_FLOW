// Regressões locais: componentes e serviços reais, React/Supabase simulados.
// Não acessa rede ou dados reais. Execute: npm test.
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const ts = require('typescript')
const crypto = require('node:crypto').webcrypto

const flush = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const ok = data => ({ data, error: null })
const fail = message => ({ data: null, error: { message } })

function database(handler) {
  return { from(table) {
    const query = { table, action: 'select', filters: [] }
    const chain = {
      select(columns) { query.columns = columns; return this },
      insert(data) { query.action = 'insert'; query.data = data; return this },
      update(data) { query.action = 'update'; query.data = data; return this },
      eq(key, value) { query.filters.push([key, value]); return this },
      in(key, value) { query.filters.push([key, Array.from(value)]); return this },
      order(key, options) { (query.orders ??= []).push([key, options]); return this },
      range(start, end) { query.range = [start, end]; return this },
      abortSignal(signal) { query.signal = signal; return this },
      single() { query.single = true; return this },
      maybeSingle() { query.single = 'maybe'; return this },
      then(resolve, reject) { return Promise.resolve().then(() => handler(query)).then(resolve, reject) },
    }
    return chain
  } }
}

function harness(filename, { supabase = {}, auth = {}, params = { id: 'event-1' }, window = {}, props = {} } = {}) {
  const slots = [], pending = [], navigations = [], cache = new Map()
  let cursor = 0, tree
  // Os componentes extraídos são de apresentação, sem hooks próprios.
  const jsx = (type, props) => typeof type === 'function' ? type(props) : ({ type, props })
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial }
      return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value }]
    },
    useRef(initial) { const i = cursor++; slots[i] ??= { current: initial }; return slots[i] },
    useEffect(fn, deps) {
      const i = cursor++, old = slots[i]
      if (!old || !deps || deps.some((v, j) => !Object.is(v, old.deps?.[j]))) {
        slots[i] = { deps, cleanup: old?.cleanup }
        pending.push(() => { slots[i].cleanup?.(); slots[i].cleanup = fn() })
      }
    },
    useCallback(fn) { return fn },
    createContext: () => ({ Provider: 'Provider' }), useContext: () => auth,
  }
  function load(file) {
    file = path.resolve(file)
    if (cache.has(file)) return cache.get(file)
    const exports = {}
    cache.set(file, exports)
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText
    vm.runInNewContext(code, {
      exports, crypto, AbortController, Error, Date, window,
      console: { error() {} },
      require(name) {
        if (name === 'react') return react
        if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx }
        if (name === 'react-router-dom') return { useNavigate: () => p => navigations.push(p), useParams: () => params, Link: 'a', Navigate: 'Navigate' }
        if (name.endsWith('/auth-context')) return { useAuth: () => auth, AuthContext: { Provider: 'Provider' } }
        if (name.endsWith('/supabase')) return { supabase }
        if (name.startsWith('.')) {
          const base = path.resolve(path.dirname(file), name)
          return load(['.ts', '.tsx', '.cjs'].map(ext => base + ext).find(p => fs.existsSync(p)))
        }
        throw new Error(`Import não simulado: ${name}`)
      },
    }, { filename: file })
    return exports
  }
  const module = load(filename)
  const name = Object.keys(module)[0]
  return {
    module, navigations,
    render() { cursor = 0; tree = module[name](props); return tree },
    async commit() { this.render(); while (pending.length) pending.shift()(); await flush(); return this.render() },
    unmount() { for (const slot of slots) slot?.cleanup?.() },
  }
}

function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return []
  const children = node.props?.children
  return [...(predicate(node) ? [node] : []), ...(Array.isArray(children) ? children.flat(Infinity) : [children]).flatMap(child => nodes(child, predicate))]
}
const byType = (tree, type) => nodes(tree, n => n.type === type)
const text = node => !node || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node) : [node.props?.children].flat(Infinity).map(text).join(' ')
const click = (tree, label) => nodes(tree, n => n.type === 'button' && text(n).includes(label))[0].props.onClick()

function authFixture(profileHandler) {
  let callback
  const db = database(profileHandler)
  db.auth = {
    getSession: async () => ok({ session: null }),
    onAuthStateChange(fn) { callback = fn; return { data: { subscription: { unsubscribe() {} } } } },
  }
  const h = harness('src/app/providers.tsx', { supabase: db })
  return { h, async event(name, id) { callback(name, id ? { user: { id } } : null); await flush() } }
}

test('perfil ausente: erro visível no login e opção de repetir', async () => {
  const { h, event } = authFixture(() => fail('perfil indisponível'))
  await h.commit()
  await event('SIGNED_IN', 'tecnico2')
  const auth = h.render().props.value
  assert.equal(auth.usuario, null)
  assert.equal(auth.carregando, false)
  assert.match(auth.erroPerfil, /perfil/)
  const login = harness('src/features/auth/login.tsx', { auth })
  const tree = await login.commit()
  assert.match(text(tree), /não foi possível carregar seu perfil/)
  assert.equal(login.navigations.length, 0)
  assert.equal(nodes(tree, n => n.type === 'button' && text(n).includes('carregar novamente')).length, 1)
})

test('logout descarta consulta de perfil atrasada', async () => {
  const response = deferred()
  const { h, event } = authFixture(() => response.promise)
  await h.commit()
  await event('SIGNED_IN', 'A')
  await event('SIGNED_OUT')
  response.resolve(ok({ id: 'A', perfil: 'tecnico' }))
  await flush()
  assert.equal(h.render().props.value.session, null)
  assert.equal(h.render().props.value.usuario, null)
})

test('troca de conta descarta perfil da conta anterior', async () => {
  const response = deferred()
  const { h, event } = authFixture(q => q.filters[0][1] === 'A' ? response.promise : ok({ id: 'B', perfil: 'estoque' }))
  await h.commit()
  await event('SIGNED_IN', 'A')
  await event('SIGNED_IN', 'B')
  response.resolve(ok({ id: 'A', perfil: 'coordenador' }))
  await flush()
  assert.equal(h.render().props.value.usuario.id, 'B')
})

test('renovação da sessão reaproveita perfil sem reiniciar carregamento', async () => {
  let calls = 0
  const { h, event } = authFixture(() => { calls++; return ok({ id: 'A', perfil: 'tecnico' }) })
  await h.commit()
  await event('SIGNED_IN', 'A')
  await event('TOKEN_REFRESHED', 'A')
  assert.equal(calls, 1)
  assert.equal(h.render().props.value.carregando, false)
})

for (const [error, expected] of [
  [{ code: 'email_not_confirmed' }, /Confirme seu e-mail/],
  [{ code: 'invalid_credentials' }, /E-mail ou senha inválidos/],
  [{ status: 429 }, /Muitas tentativas/],
  [{ status: 503 }, /Verifique sua conexão/],
]) test(`login trata erro ${error.code ?? error.status}`, async () => {
  const h = harness('src/features/auth/login.tsx', { supabase: { auth: { signInWithPassword: async () => ({ error }) } } })
  await byType(h.render(), 'form')[0].props.onSubmit({ preventDefault() {} })
  assert.match(text(h.render()), expected)
  assert.equal(byType(h.render(), 'button')[0].props.disabled, undefined)
})

test('login libera botão após exceção de rede e normaliza email', async () => {
  let sent
  const h = harness('src/features/auth/login.tsx', { supabase: { auth: { signInWithPassword: async data => { sent = data; throw new Error('offline') } } } })
  nodes(h.render(), n => n.props.id === 'email')[0].props.onChange({ target: { value: ' tecnico2@example.com ' } })
  await byType(h.render(), 'form')[0].props.onSubmit({ preventDefault() {} })
  assert.equal(sent.email, 'tecnico2@example.com')
  assert.match(text(h.render()), /Verifique sua conexão/)
  assert.equal(byType(h.render(), 'button')[0].props.disabled, undefined)
})

const dados = { cliente_nome: 'Cliente', cliente_contato: null, endereco: 'Rua', inicio: '2026-10-20T10:00:00Z', fim: '2026-10-20T11:00:00Z', observacoes: null, possui_grade: false, criado_por: 'coord' }

function preencherNovoEvento(h) {
  for (const [id, value] of Object.entries({ clienteNome: ' Cliente ', endereco: ' Rua ', inicio: '2026-10-20T10:00', fim: '2026-10-20T11:00' }))
    nodes(h.render(), n => n.props.id === id)[0].props.onChange({ target: { value } })
  nodes(h.render(), n => n.type === 'input' && n.props.type === 'checkbox').at(-1).props.onChange()
}

test('formulário bloqueia envio concorrente e retoma criação transacional com mesmo UUID', async () => {
  const calls = []
  const db = database(q => q.table === 'usuarios' ? ok([{ id: 'T', nome: 'Técnico' }]) : ok(null))
  db.rpc = async (name, args) => { calls.push({ name, args }); return calls.length === 1 ? fail('offline') : ok(args.p_evento_id) }
  const h = harness('src/features/eventos/NovoEvento.tsx', { supabase: db, auth: { usuario: { id: 'C', perfil: 'coordenador' } } })
  await h.commit()
  preencherNovoEvento(h)
  const submit = byType(h.render(), 'form')[0].props.onSubmit
  await Promise.all([submit({ preventDefault() {} }), submit({ preventDefault() {} })])
  assert.equal(calls.length, 1)
  assert.equal(calls[0].name, 'criar_evento_com_tecnicos')
  assert.equal(calls[0].args.p_cliente_nome, 'Cliente')
  assert.equal(byType(h.render(), 'fieldset')[0].props.disabled, true)
  await byType(h.render(), 'form')[0].props.onSubmit({ preventDefault() {} })
  assert.equal(calls.length, 2)
  assert.equal(calls[0].args.p_evento_id, calls[1].args.p_evento_id)
  assert.equal(h.navigations[0], `/eventos/${calls[0].args.p_evento_id}`)
})

for (const scenario of ['rejeitada', 'incerta', 'consulta falha']) test(`criação ${scenario}: edição somente após rejeição confirmada`, async () => {
  let rejeitar = true
  const calls = []
  const db = database(q => q.table === 'usuarios' ? ok([{ id: 'T', nome: 'Técnico' }])
    : scenario === 'consulta falha' ? fail('offline') : ok(null))
  db.rpc = async (name, args) => {
    calls.push(args)
    return rejeitar ? { data: null, error: { code: scenario === 'incerta' ? '' : '23514' } } : ok(args.p_evento_id)
  }
  const h = harness('src/features/eventos/NovoEvento.tsx', { supabase: db, auth: { usuario: { id: 'C', perfil: 'coordenador' } } })
  await h.commit()
  preencherNovoEvento(h)
  await byType(h.render(), 'form')[0].props.onSubmit({ preventDefault() {} })
  assert.equal(byType(h.render(), 'fieldset')[0].props.disabled, scenario !== 'rejeitada')
  if (scenario === 'rejeitada') nodes(h.render(), n => n.props.id === 'clienteNome')[0].props.onChange({ target: { value: 'Corrigido' } })
  rejeitar = false
  await byType(h.render(), 'form')[0].props.onSubmit({ preventDefault() {} })
  assert.equal(calls[1].p_cliente_nome, scenario === 'rejeitada' ? 'Corrigido' : 'Cliente')
  assert.equal(calls[0].p_evento_id === calls[1].p_evento_id, scenario !== 'rejeitada')
  assert.equal(h.navigations.length, 1)
})

test('criação transacional: envia técnicos únicos, preserva campos e não repete RPC após confirmação', async () => {
  const calls = []
  const db = { rpc: async (name, args) => { calls.push({ name, args }); return ok(args.p_evento_id) } }
  const { criarOperacaoEvento, salvarEvento } = harness('src/lib/criar-evento.ts', { supabase: db }).module
  const operation = criarOperacaoEvento()
  await salvarEvento(operation, dados, ['T', 'T', 'T2'])
  await salvarEvento(operation, dados, ['T', 'T2'])
  assert.equal(calls.length, 1)
  assert.deepEqual(Array.from(calls[0].args.p_tecnico_ids), ['T', 'T2'])
  assert.equal(calls[0].args.p_evento_id, operation.id)
  assert.equal(calls[0].args.p_inicio, dados.inicio)
  assert.equal(calls[0].args.p_fim, dados.fim)
  assert.equal(calls[0].args.p_observacoes, null)
  assert.equal('p_criado_por' in calls[0].args, false)
})

test('criação: resposta perdida depois de commit repete RPC com mesmo UUID sem duplicar', async () => {
  const rows = new Set(), calls = []
  const db = { rpc: async (name, args) => {
    rows.add(args.p_evento_id); calls.push(args)
    return calls.length === 1 ? fail('resposta perdida') : ok(args.p_evento_id)
  } }
  const { criarOperacaoEvento, salvarEvento } = harness('src/lib/criar-evento.ts', { supabase: db }).module
  const operation = criarOperacaoEvento()
  await assert.rejects(salvarEvento(operation, dados, ['T']), {
    message: 'Não foi possível confirmar a criação. Tente novamente nesta tela.',
  })
  assert.equal(operation.rejeitada, false)
  await salvarEvento(operation, dados, ['T'])
  assert.equal(operation.criado, true)
  assert.equal(rows.size, 1)
  assert.equal(calls[0].p_evento_id, calls[1].p_evento_id)
})

test('criação: erro em evento já existente preserva UUID e não libera edição', async () => {
  const db = database(() => ok({ id: 'existente' }))
  db.rpc = async () => ({ data: null, error: { code: '23514' } })
  const { criarOperacaoEvento, salvarEvento } = harness('src/lib/criar-evento.ts', { supabase: db }).module
  const operation = criarOperacaoEvento()
  await assert.rejects(salvarEvento(operation, dados, ['T']), /confirmar/)
  assert.equal(operation.rejeitada, false)
})
function storageFixture({ failUpload = false, failInsert = false, uncertainInsert = false, uncertainUpload = false } = {}) {
  const uploads = [], rows = new Map(), stored = new Set()
  let insertCalls = 0, failures = 0
  const db = database(q => {
    if (q.action === 'select') return ok(rows.get(q.filters[0][1]) ?? null)
    insertCalls++
    if (failInsert && failures++ === 0) return fail('banco indisponível')
    rows.set(q.data.id, q.data)
    return uncertainInsert ? fail('resposta perdida') : ok(null)
  })
  db.storage = { from: () => ({
    upload: async (key, file) => {
      uploads.push(file.name)
      if (failUpload && file.name === 'segundo.pdf' && failures++ === 0) return fail('offline')
      stored.add(key)
      return uncertainUpload ? fail('resposta perdida') : ok(null)
    },
    info: async key => stored.has(key) ? ok({}) : fail('não encontrado'),
  }) }
  return { db, uploads, rows, get insertCalls() { return insertCalls } }
}
const files = [{ name: 'primeiro.pdf', size: 100 }, { name: 'segundo.pdf', size: 100 }]

test('lote parcial: repetir não reenvia primeiro arquivo concluído', async () => {
  const fixture = storageFixture({ failUpload: true })
  const queue = harness('src/lib/anexos.ts', { supabase: fixture.db }).module.criarFilaAnexos()
  async function batch() { for (const file of files) await queue.enviar('E', 'matriz', file, 'C') }
  await assert.rejects(batch(), /Erro ao enviar/)
  await batch()
  assert.equal(fixture.rows.size, 2)
  assert.deepEqual(fixture.uploads, ['primeiro.pdf', 'segundo.pdf', 'segundo.pdf'])
})

test('falha no registro retoma insert com o mesmo ID sem novo upload', async () => {
  const fixture = storageFixture({ failInsert: true })
  const queue = harness('src/lib/anexos.ts', { supabase: fixture.db }).module.criarFilaAnexos()
  await assert.rejects(queue.enviar('E', 'matriz', files[0], 'C'), /registro não foi confirmado/)
  await queue.enviar('E', 'matriz', files[0], 'C')
  assert.equal(fixture.uploads.length, 1)
  assert.equal(fixture.rows.size, 1)
})

test('upload e insert com resposta perdida são reconhecidos sem duplicação', async () => {
  const fixture = storageFixture({ uncertainUpload: true, uncertainInsert: true })
  const queue = harness('src/lib/anexos.ts', { supabase: fixture.db }).module.criarFilaAnexos()
  await queue.enviar('E', 'matriz', files[0], 'C')
  await queue.enviar('E', 'matriz', files[0], 'C')
  assert.equal(fixture.uploads.length, 1)
  assert.equal(fixture.insertCalls, 1)
  assert.equal(fixture.rows.size, 1)
})

test('upload recusa arquivos vazios, acima de 20 MB ou lote acima de 20', () => {
  const { validarArquivos } = harness('src/lib/anexos.ts').module
  assert.throws(() => validarArquivos([{ name: 'vazio', size: 0 }]), /20 MB/)
  assert.throws(() => validarArquivos([{ name: 'grande', size: 21 * 1024 * 1024 }]), /20 MB/)
  assert.throws(() => validarArquivos(Array(21).fill(files[0])), /20 arquivos/)
  assert.doesNotThrow(() => validarArquivos(files))
})

test('envio em lote limita concorrência a três e informa sucesso parcial', async () => {
  const { enviarLoteAnexos } = harness('src/lib/anexos.ts').module
  let active = 0, maximum = 0
  const completed = []
  const queue = { async enviar(_id, _type, file) {
    active++; maximum = Math.max(maximum, active)
    await flush()
    active--
    if (file.name === '2') throw new Error('falhou 2')
  } }
  const selected = Array.from({ length: 7 }, (_, i) => ({ name: String(i), size: 10 }))
  await assert.rejects(enviarLoteAnexos(queue, 'E', 'matriz', selected, 'C', file => completed.push(file.name)), /falhou 2/)
  assert.equal(maximum, 3)
  assert.equal(completed.length, 6)
  assert.equal(completed.includes('2'), false)
})

test('detalhe mantém somente arquivos pendentes após falha parcial', async () => {
  const fixture = storageFixture({ failUpload: true })
  const actualFrom = fixture.db.from
  fixture.db.from = table => {
    const query = database(q => q.table === 'eventos' ? ok({ id: 'event-1', cliente_nome: 'Cliente' })
      : q.table === 'anexos' ? ok([...fixture.rows.values()]) : ok([])).from(table)
    if (table === 'anexos') query.insert = data => actualFrom(table).insert(data)
    return query
  }
  const h = harness('src/features/eventos/DetalheEvento.tsx', {
    supabase: fixture.db, auth: { usuario: { id: 'C', perfil: 'coordenador' } },
  })
  await h.commit()
  nodes(h.render(), n => n.props.id === 'arquivoAnexo')[0].props.onChange({ target: { files } })
  await click(h.render(), 'Enviar anexos')
  let tree = h.render()
  const fileLabels = byType(tree, 'li').map(text)
  assert.equal(fileLabels.includes('primeiro.pdf'), false)
  assert.equal(fileLabels.includes('segundo.pdf'), true)
  await click(tree, 'Enviar anexos')
  tree = h.render()
  assert.equal(byType(tree, 'li').map(text).includes('segundo.pdf'), false)
  assert.equal(fixture.rows.size, 2)
  assert.equal(fixture.uploads.filter(name => name === 'primeiro.pdf').length, 1)
})

test('listagem de técnico usa vínculo e paginação estável com próximo lote', async () => {
  const calls = []
  const db = database(q => { calls.push(q); return ok(Array.from({ length: 26 }, (_, i) => ({ id: String(i), cliente_nome: `Cliente ${i}` }))) })
  const h = harness('src/features/eventos/Eventos.tsx', { supabase: db, auth: { usuario: { id: 'T', perfil: 'tecnico' } } })
  let tree = await h.commit()
  assert.equal(byType(tree, 'article').length, 25)
  assert.match(calls[0].columns, /eventos_tecnicos!inner/)
  assert.deepEqual(calls[0].filters[0], ['eventos_tecnicos.tecnico_id', 'T'])
  assert.deepEqual(calls[0].range, [0, 25])
  assert.equal(calls[0].orders[1][0], 'id')
  click(tree, 'Próxima')
  tree = await h.commit()
  assert.deepEqual(calls[1].range, [25, 50])
  assert.match(text(tree), /Página\s+2/)
})

test('listagem vazia e erro de rede encerram carregamento e permitem repetir', async () => {
  let offline = true
  const h = harness('src/features/eventos/Eventos.tsx', {
    supabase: database(() => { if (offline) throw new Error('offline'); return ok([]) }),
    auth: { usuario: { id: 'C', perfil: 'coordenador' } },
  })
  assert.match(text(await h.commit()), /Não foi possível carregar/)
  offline = false
  click(h.render(), 'Tentar novamente')
  assert.match(text(await h.commit()), /Nenhum evento encontrado/)
})

test('detalhe mostra erro parcial sem afirmar que movimentações não existem', async () => {
  const db = database(q => q.table === 'eventos' ? ok({ id: 'event-1', cliente_nome: 'Cliente' }) : q.table === 'movimentacoes_equipamentos' ? fail('RLS') : ok([]))
  const h = harness('src/features/eventos/DetalheEvento.tsx', { supabase: db })
  const tree = await h.commit()
  assert.match(text(tree), /Não foi possível carregar as movimentações/)
  assert.doesNotMatch(text(tree), /Nenhuma movimentação registrada/)
})

test('falha ao carregar técnicos mostra mensagem simples e permite tentar novamente', async () => {
  let falhar = true
  const db = database(q => q.table === 'eventos' ? ok({ id: 'event-1', cliente_nome: 'Cliente' })
    : q.table === 'eventos_tecnicos' && falhar ? fail('RLS') : ok([]))
  const h = harness('src/features/eventos/DetalheEvento.tsx', { supabase: db })
  const tree = await h.commit()
  assert.match(text(tree), /Não foi possível carregar os técnicos/)
  assert.doesNotMatch(text(tree), /Nenhum técnico associado/)
  falhar = false
  click(tree, 'Tentar carregar novamente')
  const recuperado = await h.commit()
  assert.doesNotMatch(text(recuperado), /Não foi possível carregar os técnicos/)
  assert.match(text(recuperado), /Nenhum técnico associado/)
})

test('troca de evento aborta consulta anterior e ignora resultado atrasado', async () => {
  const old = deferred(), calls = [], params = { id: 'event-1' }
  const db = database(q => {
    calls.push(q)
    if (q.table !== 'eventos') return ok([])
    return q.filters[0][1] === 'event-1' ? old.promise : ok({ id: 'event-2', cliente_nome: 'Atual' })
  })
  const h = harness('src/features/eventos/DetalheEvento.tsx', { supabase: db, params })
  await h.commit()
  params.id = 'event-2'
  await h.commit()
  old.resolve(ok({ id: 'event-1', cliente_nome: 'Antigo' }))
  await flush()
  assert.equal(calls[0].signal.aborted, true)
  assert.match(text(h.render()), /Atual/)
  assert.doesNotMatch(text(h.render()), /Antigo/)
})

// Regressões do novo fluxo de equipamentos, com consultas e atualizações simuladas.
function movimentacoesFixture({ movimentacoes = [], falha = false, salvar, params = { id: 'event-1' } } = {}) {
  let updates = 0
  const db = database(q => {
    if (q.table === 'eventos') {
      const evento = { id: q.filters[0][1], cliente_nome: q.filters[0][1], status: 'em_andamento' }
      if (q.action === 'update') { updates++; return salvar ? salvar(q) : ok({ ...evento, ...q.data }) }
      return ok(evento)
    }
    if (q.table === 'movimentacoes_equipamentos') return falha ? fail('offline') : ok(movimentacoes)
    return ok([])
  })
  const h = harness('src/features/eventos/DetalheEvento.tsx', {
    supabase: db, auth: { usuario: { id: 'T', perfil: 'tecnico' } }, params,
  })
  return { h, updates: () => updates }
}
const finalizar = h => nodes(h.render(), n => n.type === 'button' && text(n).includes('Finalizar evento'))[0]
const entregaRadio = { id: 'E', numero_radio: '101', tipo_acessorio: 'fone', modelo_acessorio: { nome: 'Fone P2' } }
const movimentos = (devolucao = []) => [
  { id: 'ME', tipo: 'entrega', pessoa_nome: 'Cliente', criado_em: '2026-11-09T12:00:00Z', itens: [entregaRadio] },
  { id: 'MD', tipo: 'devolucao', pessoa_nome: 'Cliente', criado_em: '2026-11-09T13:00:00Z', itens: devolucao },
]

test('equipamentos: entrega pendente bloqueia botão e handler de finalização', async () => {
  const { h, updates } = movimentacoesFixture({ movimentacoes: movimentos() })
  await h.commit()
  assert.equal(finalizar(h).props.disabled, true)
  await finalizar(h).props.onClick()
  assert.equal(updates(), 0)
  click(h.render(), 'Pendentes')
  assert.match(text(h.render()), /Rádio\s+101/)
  assert.match(text(h.render()), /Fone P2/)
})

test('equipamentos: devolução completa libera finalização', async () => {
  const { h, updates } = movimentacoesFixture({ movimentacoes: movimentos([
    { ...entregaRadio, id: 'D', item_entrega_origem_id: 'E', situacao_radio: 'devolvido', situacao_acessorio: 'danificado' },
  ]) })
  await h.commit()
  assert.equal(finalizar(h).props.disabled, false)
  await finalizar(h).props.onClick()
  assert.equal(updates(), 1)
  assert.match(text(h.render()), /Evento finalizado/)
})

test('equipamentos: vínculo sem situação do rádio ou acessório mantém pendência', async () => {
  for (const situacoes of [
    { situacao_radio: null, situacao_acessorio: 'devolvido' },
    { situacao_radio: 'devolvido', situacao_acessorio: null },
    { situacao_radio: 'devolvido', situacao_acessorio: 'nao_se_aplica' },
  ]) {
    const { h } = movimentacoesFixture({ movimentacoes: movimentos([
      { ...entregaRadio, id: 'D', item_entrega_origem_id: 'E', ...situacoes },
    ]) })
    await h.commit()
    assert.equal(finalizar(h).props.disabled, true)
  }
})

test('equipamentos: evento vazio permite finalizar; consulta com erro bloqueia', async () => {
  const vazio = movimentacoesFixture()
  await vazio.h.commit()
  assert.equal(finalizar(vazio.h).props.disabled, false)
  const falha = movimentacoesFixture({ falha: true })
  await falha.h.commit()
  assert.equal(finalizar(falha.h).props.disabled, true)
  await finalizar(falha.h).props.onClick()
  assert.equal(falha.updates(), 0)
})

test('status: clique duplicado envia uma única atualização e falha permite repetir', async () => {
  const resposta = deferred()
  let primeiro = true
  const { h, updates } = movimentacoesFixture({ salvar: q => {
    if (primeiro) { primeiro = false; return resposta.promise }
    return ok({ id: 'event-1', cliente_nome: 'Cliente', ...q.data })
  } })
  await h.commit()
  const botao = finalizar(h)
  const envio = botao.props.onClick()
  await botao.props.onClick()
  resposta.resolve(fail('offline'))
  await envio
  assert.equal(updates(), 1)
  assert.equal(finalizar(h).props.disabled, false)
  await finalizar(h).props.onClick()
  assert.equal(updates(), 2)
  assert.match(text(h.render()), /Evento finalizado/)
})

test('status: resposta atrasada de outro evento não altera a tela atual', async () => {
  const resposta = deferred(), params = { id: 'event-1' }
  const { h } = movimentacoesFixture({ salvar: () => resposta.promise, params })
  await h.commit()
  const envio = finalizar(h).props.onClick()
  params.id = 'event-2'
  await h.commit()
  resposta.resolve(ok({ id: 'event-1', cliente_nome: 'Antigo', status: 'finalizado' }))
  await envio
  assert.match(text(h.render()), /event-2/)
  assert.doesNotMatch(text(h.render()), /Antigo/)
  assert.equal(finalizar(h).props.disabled, false)
})

function entregaFixture({ rpc = () => ok(null), movimentacoes = [], params = { id: 'event-1' }, consultar } = {}) {
  const calls = []
  const queries = []
  const db = database(q => { queries.push(q); if (consultar) { const result = consultar(q); if (result) return result }
    return q.table === 'eventos'
    ? ok({ id: q.filters[0][1], cliente_nome: q.filters[0][1], status: 'em_andamento' })
    : q.table === 'movimentacoes_equipamentos' ? ok(movimentacoes) : ok([]) })
  db.rpc = (name, args) => { calls.push({ name, args }); return rpc(name, args) }
  const h = harness('src/features/eventos/DetalheEvento.tsx', {
    supabase: db, auth: { usuario: { id: 'T', perfil: 'tecnico' } }, params,
  })
  return { h, calls, queries }
}
function preencherEntrega(h, numero = ' r01 ') {
  click(h.render(), 'Registrar entrega')
  byType(h.render(), 'input').find(n => n.props.placeholder === 'Ex.: Zezinho').props.onChange({ target: { value: ' Cliente ' } })
  byType(h.render(), 'input').find(n => n.props.placeholder === 'Ex.: 01').props.onChange({ target: { value: numero } })
}

test('entrega: valida campos obrigatórios e bloqueia finalização com formulário aberto', async () => {
  const { h, calls } = entregaFixture()
  await h.commit()
  click(h.render(), 'Registrar entrega')
  assert.equal(finalizar(h).props.disabled, true)
  click(h.render(), 'Salvar entrega')
  await flush()
  assert.match(text(h.render()), /Informe quem recebeu/)
  assert.equal(calls.length, 0)
  click(h.render(), 'Cancelar')
  assert.equal(finalizar(h).props.disabled, false)
})

test('entrega: normaliza payload, bloqueia duplicidade e recarrega após sucesso', async () => {
  const resposta = deferred()
  const { h, calls } = entregaFixture({ rpc: () => resposta.promise })
  await h.commit()
  preencherEntrega(h)
  const salvar = byType(h.render(), 'button').find(n => text(n).includes('Salvar entrega'))
  salvar.props.onClick()
  salvar.props.onClick()
  assert.equal(calls.length, 1)
  assert.equal(calls[0].name, 'registrar_entrega_equipamentos')
  assert.equal(calls[0].args.p_pessoa_nome, 'Cliente')
  assert.equal(calls[0].args.p_itens[0].numero_radio, 'R01')
  assert.equal(calls[0].args.p_itens[0].modelo_acessorio_id, null)
  assert.equal(finalizar(h).props.disabled, true)
  resposta.resolve(ok(null))
  await flush()
  await h.commit()
  assert.doesNotMatch(text(h.render()), /Quem recebeu os equipamentos/)
})

test('entrega: falha preserva rascunho; rádio pendente não pode ser entregue novamente', async () => {
  const { h, calls } = entregaFixture({ rpc: () => fail('Falha de teste') })
  await h.commit()
  preencherEntrega(h)
  click(h.render(), 'Salvar entrega')
  await flush()
  assert.match(text(h.render()), /Falha de teste/)
  assert.equal(byType(h.render(), 'input').find(n => n.props.placeholder === 'Ex.: 01').props.value, ' r01 ')
  assert.equal(calls.length, 1)
  const pendente = entregaFixture({ movimentacoes: movimentos() })
  await pendente.h.commit()
  preencherEntrega(pendente.h, ' 101 ')
  click(pendente.h.render(), 'Salvar entrega')
  await flush()
  assert.equal(pendente.calls.length, 0)
  assert.match(text(pendente.h.render()), /já possui entrega pendente/)
})

test('entrega: resposta de rota antiga não libera trava do novo envio', async () => {
  const antiga = deferred(), nova = deferred(), params = { id: 'event-1' }
  const { h, calls } = entregaFixture({ params, rpc: () => calls.length === 1 ? antiga.promise : nova.promise })
  await h.commit()
  preencherEntrega(h)
  click(h.render(), 'Salvar entrega')
  params.id = 'event-2'
  await h.commit()
  preencherEntrega(h)
  const botao = byType(h.render(), 'button').find(n => text(n).includes('Salvar entrega'))
  botao.props.onClick()
  antiga.resolve(ok(null))
  await flush()
  botao.props.onClick()
  assert.equal(calls.length, 2)
  assert.equal(calls[1].args.p_evento_id, 'event-2')
  nova.resolve(ok(null))
  await flush()
})

function preencherDevolucao(h) {
  click(h.render(), 'Registrar devolução')
  byType(h.render(), 'input').find(n => n.props.placeholder === 'Ex.: Eduardo')
    .props.onChange({ target: { value: ' Eduardo ' } })
  byType(h.render(), 'input').find(n => n.props.type === 'checkbox')
    .props.onChange({ target: { checked: true } })
}

test('devolução: exige pessoa e seleção, sem enviar dados inválidos', async () => {
  const { h, calls } = entregaFixture({ movimentacoes: movimentos() })
  await h.commit()
  click(h.render(), 'Registrar devolução')
  click(h.render(), 'Salvar devolução')
  await flush()
  assert.match(text(h.render()), /Informe quem devolveu/)
  byType(h.render(), 'input').find(n => n.props.placeholder === 'Ex.: Eduardo')
    .props.onChange({ target: { value: 'Eduardo' } })
  click(h.render(), 'Salvar devolução')
  await flush()
  assert.match(text(h.render()), /Selecione pelo menos um rádio/)
  assert.equal(calls.length, 0)
})

test('devolução: envia apenas selecionados, aceita perdido/danificado e atualiza somente histórico', async () => {
  const lista = movimentos()
  lista[0].itens.push({ ...entregaRadio, id: 'E2', numero_radio: '102' })
  let devolvido = false
  const { h, calls, queries } = entregaFixture({ movimentacoes: lista,
    rpc: () => { devolvido = true; return ok(null) },
    consultar: q => q.table === 'movimentacoes_equipamentos' && devolvido
      ? ok(movimentos([{ ...entregaRadio, id: 'D', item_entrega_origem_id: 'E', situacao_radio: 'perdido', situacao_acessorio: 'danificado' }])) : null,
  })
  await h.commit()
  preencherDevolucao(h)
  const selects = byType(h.render(), 'select')
  selects[0].props.onChange({ target: { value: 'perdido' } })
  selects[1].props.onChange({ target: { value: 'danificado' } })
  click(h.render(), 'Salvar devolução')
  await flush()
  assert.equal(calls.length, 1)
  assert.equal(calls[0].name, 'registrar_devolucao_equipamentos')
  assert.equal(calls[0].args.p_pessoa_nome, 'Eduardo')
  assert.equal(calls[0].args.p_itens.length, 1)
  assert.equal(calls[0].args.p_itens[0].item_entrega_origem_id, 'E')
  assert.equal(calls[0].args.p_itens[0].situacao_radio, 'perdido')
  assert.equal(calls[0].args.p_itens[0].situacao_acessorio, 'danificado')
  assert.equal(queries.filter(q => q.table === 'movimentacoes_equipamentos').length, 2)
  for (const table of ['eventos', 'eventos_tecnicos', 'anexos', 'modelos_acessorio'])
    assert.equal(queries.filter(q => q.table === table).length, 1)
  assert.equal(finalizar(h).props.disabled, false)
})

test('devolução: sem acessório envia não se aplica e erro preserva rascunho', async () => {
  const lista = movimentos()
  lista[0].itens[0] = { ...entregaRadio, tipo_acessorio: 'sem_acessorio', modelo_acessorio_id: null, modelo_acessorio: null }
  const { h, calls } = entregaFixture({ movimentacoes: lista, rpc: () => fail('Falha ao devolver') })
  await h.commit()
  preencherDevolucao(h)
  click(h.render(), 'Salvar devolução')
  await flush()
  assert.equal(calls[0].args.p_itens[0].situacao_acessorio, 'nao_se_aplica')
  assert.equal(byType(h.render(), 'input').find(n => n.props.type === 'checkbox').props.checked, true)
  assert.match(text(h.render()), /Falha ao devolver/)
  assert.equal(finalizar(h).props.disabled, true)
})

test('devolução: clique duplo e resposta de rota antiga não liberam novo envio', async () => {
  const antiga = deferred(), nova = deferred(), params = { id: 'event-1' }
  const { h, calls } = entregaFixture({ movimentacoes: movimentos(), params,
    rpc: () => calls.length === 1 ? antiga.promise : nova.promise,
  })
  await h.commit()
  preencherDevolucao(h)
  const salvar = byType(h.render(), 'button').find(n => text(n).includes('Salvar devolução'))
  salvar.props.onClick()
  salvar.props.onClick()
  assert.equal(calls.length, 1)
  params.id = 'event-2'
  await h.commit()
  preencherDevolucao(h)
  const atual = byType(h.render(), 'button').find(n => text(n).includes('Salvar devolução'))
  atual.props.onClick()
  antiga.resolve(ok(null))
  await flush()
  atual.props.onClick()
  assert.equal(calls.length, 2)
  assert.equal(calls[1].args.p_evento_id, 'event-2')
  nova.resolve(ok(null))
  await flush()
})

test('movimentação salva com falha ao atualizar histórico bloqueia finalização sem repetir RPC', async () => {
  let salvo = false
  const { h, calls } = entregaFixture({ rpc: () => { salvo = true; return ok(null) },
    consultar: q => q.table === 'movimentacoes_equipamentos' && salvo ? fail('offline') : null,
  })
  await h.commit()
  preencherEntrega(h)
  click(h.render(), 'Salvar entrega')
  await flush()
  assert.equal(calls.length, 1)
  assert.match(text(h.render()), /Registro salvo, mas não foi possível atualizar/)
  assert.equal(finalizar(h).props.disabled, true)
  salvo = false
  click(h.render(), 'Tentar carregar novamente')
  await h.commit()
  assert.equal(calls.length, 1)
  assert.equal(finalizar(h).props.disabled, false)
})

const filtrarEventos = (h, value) => byType(h.render(), 'select')[0].props.onChange({ target: { value } })

test('detalhe: falha inicial permite tentar novamente sem sair da página', async () => {
  let offline = true
  const h = harness('src/features/eventos/DetalheEvento.tsx', {
    supabase: database(q => q.table === 'eventos'
      ? offline ? fail('offline') : ok({ id: 'event-1', cliente_nome: 'Evento recuperado', status: 'agendado' })
      : ok([])),
  })
  await h.commit()
  assert.match(text(h.render()), /Não foi possível carregar o evento/)
  offline = false
  click(h.render(), 'Tentar novamente')
  await h.commit()
  assert.match(text(h.render()), /Evento recuperado/)
  assert.doesNotMatch(text(h.render()), /Não foi possível carregar o evento/)
})

test('histórico de eventos: inicia em concluídos, inclui recebidos e preserva vínculo do técnico', async () => {
  const calls = []
  const h = harness('src/features/eventos/Eventos.tsx', {
    props: { historico: true }, auth: { usuario: { id: 'T', perfil: 'tecnico' } },
    supabase: database(q => { calls.push(q); return ok([]) }),
  })
  await h.commit()
  assert.match(text(h.render()), /Histórico de eventos/)
  assert.deepEqual(calls[0].filters, [['eventos_tecnicos.tecnico_id', 'T'], ['status', ['finalizado', 'recebido']]])
  assert.equal(calls[0].orders[0][1].ascending, false)
  filtrarEventos(h, 'para_fazer')
  await h.commit()
  assert.deepEqual(calls[1].filters[1], ['status', ['agendado', 'em_andamento']])
  assert.equal(calls[1].orders[0][1].ascending, true)
  filtrarEventos(h, 'todos')
  await h.commit()
  assert.deepEqual(calls[2].filters, [['eventos_tecnicos.tecnico_id', 'T']])
})

test('filtro de eventos: aplica status na consulta e reinicia paginação', async () => {
  const calls = []
  const h = harness('src/features/eventos/Eventos.tsx', {
    auth: { usuario: { id: 'C', perfil: 'coordenador' } },
    supabase: database(q => { calls.push(q); return ok(Array.from({ length: 26 }, (_, i) => ({ id: String(i), status: 'agendado' }))) }),
  })
  await h.commit()
  click(h.render(), 'Próxima')
  await h.commit()
  assert.deepEqual(calls[1].range, [25, 50])
  filtrarEventos(h, 'concluidos')
  await h.commit()
  assert.deepEqual(calls[2].range, [0, 25])
  assert.deepEqual(calls[2].filters, [['status', ['finalizado', 'recebido']]])
  assert.match(text(h.render()), /Página\s+1/)
})

test('filtros de histórico: resposta anterior é abortada e não substitui o novo filtro', async () => {
  const old = deferred(), calls = []
  const h = harness('src/features/eventos/Eventos.tsx', {
    auth: { usuario: { id: 'C', perfil: 'coordenador' } },
    supabase: database(q => { calls.push(q); return calls.length === 1 ? old.promise : ok([{ id: 'N', cliente_nome: 'Concluído atual', status: 'recebido' }]) }),
  })
  await h.commit()
  filtrarEventos(h, 'concluidos')
  await h.commit()
  old.resolve(ok([{ id: 'A', cliente_nome: 'Resultado antigo', status: 'agendado' }]))
  await flush()
  assert.equal(calls[0].signal.aborted, true)
  assert.match(text(h.render()), /Concluído atual/)
  assert.doesNotMatch(text(h.render()), /Resultado antigo/)
})

test('histórico de movimentações: ordena recentes primeiro, exibe detalhes e permite fechar', async () => {
  const lista = movimentos([{ ...entregaRadio, id: 'D', item_entrega_origem_id: 'E', situacao_radio: 'devolvido', situacao_acessorio: 'danificado' }])
  lista[0].pessoa_nome = 'Entrega antiga'
  lista[1].pessoa_nome = 'Devolução recente'
  const { h } = entregaFixture({ movimentacoes: lista })
  await h.commit()
  click(h.render(), 'Movimentações')
  const articles = byType(h.render(), 'article')
  assert.match(text(articles[0]), /Devolução recente/)
  assert.match(text(articles[1]), /Entrega antiga/)
  assert.equal(byType(h.render(), 'details').length, 2)
  assert.match(text(h.render()), /Danificado/)
  click(h.render(), 'Fechar histórico')
  assert.equal(byType(h.render(), 'article').length, 0)
})

for (const tipo of ['entrega', 'devolucao']) test(`${tipo}: resposta perdida reutiliza chave e edição gera nova operação`, async () => {
  const registros = new Map()
  const { h, calls } = entregaFixture({ movimentacoes: tipo === 'devolucao' ? movimentos() : [],
    rpc: (name, args) => {
      registros.set(args.p_operacao_id, args)
      return fail('Resposta perdida depois de salvar')
    },
  })
  await h.commit()
  if (tipo === 'entrega') preencherEntrega(h)
  else preencherDevolucao(h)
  const salvar = () => click(h.render(), tipo === 'entrega' ? 'Salvar entrega' : 'Salvar devolução')
  salvar(); await flush()
  const chave = calls[0].args.p_operacao_id
  assert.match(chave, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  salvar(); await flush()
  assert.equal(calls[1].args.p_operacao_id, chave)
  assert.equal(registros.size, 1)
  const pessoa = byType(h.render(), 'input').find(n => n.props.placeholder === (tipo === 'entrega' ? 'Ex.: Zezinho' : 'Ex.: Eduardo'))
  pessoa.props.onChange({ target: { value: 'Pessoa corrigida' } })
  salvar(); await flush()
  assert.notEqual(calls[2].args.p_operacao_id, chave)
  assert.equal(registros.size, 2)
  byType(h.render(), 'textarea')[0].props.onChange({ target: { value: 'Observação nova' } })
  salvar(); await flush()
  assert.notEqual(calls[3].args.p_operacao_id, calls[2].args.p_operacao_id)
  salvar(); await flush()
  assert.equal(calls[4].args.p_operacao_id, calls[3].args.p_operacao_id)
  click(h.render(), 'Cancelar')
  if (tipo === 'entrega') preencherEntrega(h)
  else preencherDevolucao(h)
  salvar(); await flush()
  assert.notEqual(calls[5].args.p_operacao_id, chave)
})

test('entrega: edição do rádio após falha troca a chave da operação', async () => {
  const { h, calls } = entregaFixture({ rpc: () => fail('offline') })
  await h.commit()
  preencherEntrega(h)
  click(h.render(), 'Salvar entrega'); await flush()
  byType(h.render(), 'input').find(n => n.props.placeholder === 'Ex.: 01').props.onChange({ target: { value: 'R02' } })
  click(h.render(), 'Salvar entrega'); await flush()
  assert.notEqual(calls[0].args.p_operacao_id, calls[1].args.p_operacao_id)
  assert.equal(calls[1].args.p_itens[0].numero_radio, 'R02')
})

test('devolução: alteração da situação após falha troca a chave da operação', async () => {
  const { h, calls } = entregaFixture({ movimentacoes: movimentos(), rpc: () => fail('offline') })
  await h.commit()
  preencherDevolucao(h)
  click(h.render(), 'Salvar devolução'); await flush()
  byType(h.render(), 'select')[0].props.onChange({ target: { value: 'perdido' } })
  click(h.render(), 'Salvar devolução'); await flush()
  assert.notEqual(calls[0].args.p_operacao_id, calls[1].args.p_operacao_id)
  assert.equal(calls[1].args.p_itens[0].situacao_radio, 'perdido')
})

for (const tipo of ['entrega', 'devolucao']) test(`${tipo}: falha de rede mostra orientação de recuperação em português`, async () => {
  const { h } = entregaFixture({ movimentacoes: tipo === 'devolucao' ? movimentos() : [],
    rpc: () => fail('TypeError: Failed to fetch'),
  })
  await h.commit()
  if (tipo === 'entrega') preencherEntrega(h)
  else preencherDevolucao(h)
  click(h.render(), tipo === 'entrega' ? 'Salvar entrega' : 'Salvar devolução')
  await flush()
  assert.match(text(h.render()), /Tente novamente sem alterar os dados para reutilizar a mesma operação/)
  assert.doesNotMatch(text(h.render()), /Failed to fetch/)
})
