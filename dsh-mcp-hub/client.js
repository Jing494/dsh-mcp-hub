window.__ModuleLoader__.load({
  id: 'dsh-mcp-hub',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'mcp'
    const SETTINGS_NS = 'mcp-hub'
    const API = '/api/mcp-hub'

    const zh = {
      nav: 'MCP',
      title: 'MCP 服务器',
      intro: '远程 MCP 服务器：加一条地址、测试连接、列出它提供的工具。',
      empty: '还没有配置任何 MCP 服务器。',
      emptyHint: '点右上角「添加服务器」，传输默认 auto（先 streamable-http，失败自动降级 SSE）。',
      add: '添加',
      addServer: '添加服务器',
      name: '名称',
      nameHint: '工具命名空间：mcp__名称__工具',
      url: '地址',
      transport: '传输',
      remove: '删除',
      test: '测试',
      testing: '连接中…',
      disabled: '已停用',
      enable: '启用',
      disable: '停用',
      tools: '工具',
      noTools: '这个服务器没有返回任何工具。',
      call: '调用',
      args: '参数（JSON）',
      connected: '已连接',
      failed: '失败',
      idle: '未连接',
      latency: '耗时',
      nameInvalid: '名称只能包含字母、数字、下划线和连字符，1–32 个字符',
      urlInvalid: '地址必须以 http:// 或 https:// 开头',
      saving: '保存中…',
      saveFailed: '保存失败：',
      loadFailed: '读取配置失败：',
      rawError: '原始错误',
      hints: '最可能的原因',
      hintHeader: '服务器要认证：在 config 的 headers 里补 Authorization',
      hintUrl: 'URL 路径不对：多数 MCP 端点是 /mcp 或 /sse，而不是站点根路径',
      hintTransport: '传输选错：把传输固定成 sse 或 streamable-http 再试',
      hintRefused: '连不上：确认地址与端口，服务是否已启动',
      hintNone: '没命中常见原因，请看原始错误',
      whitelist: '工具白名单（留空 = 全开）',
      whitelistSave: '保存白名单',
      whitelistHint: '逗号分隔；保存后重新点「测试」生效',
      edit: '编辑',
      save: '保存',
      cancel: '取消',
      count: '{n} 台已配置',
      expand: '展开',
      collapse: '收起',
    }

    const en = {
      nav: 'MCP',
      title: 'MCP servers',
      intro: 'Remote MCP servers: add an endpoint, test the connection, and list its tools.',
      empty: 'No MCP server configured yet.',
      emptyHint: 'Use "Add server" at the top right. Transport defaults to auto (streamable-http first, SSE on failure).',
      add: 'Add',
      addServer: 'Add server',
      name: 'Name',
      nameHint: 'Tool namespace: mcp__name__tool',
      url: 'Endpoint',
      transport: 'Transport',
      remove: 'Remove',
      test: 'Test',
      testing: 'Connecting…',
      disabled: 'Disabled',
      enable: 'Enable',
      disable: 'Disable',
      tools: 'Tools',
      noTools: 'This server returned no tools.',
      call: 'Call',
      args: 'Arguments (JSON)',
      connected: 'Connected',
      failed: 'Failed',
      idle: 'Not connected',
      latency: 'took',
      nameInvalid: 'Name must be 1–32 characters of letters, digits, underscore, or hyphen',
      urlInvalid: 'Endpoint must start with http:// or https://',
      saving: 'Saving…',
      saveFailed: 'Save failed: ',
      loadFailed: 'Could not read the config: ',
      rawError: 'Raw error',
      hints: 'Most likely causes',
      hintHeader: 'The server wants auth: add an Authorization header in config',
      hintUrl: 'Wrong URL path: most MCP endpoints are /mcp or /sse, not the site root',
      hintTransport: 'Wrong transport: pin it to sse or streamable-http and retry',
      hintRefused: 'Unreachable: check the address and port, and that the server is running',
      hintNone: 'No common cause matched; read the raw error below',
      whitelist: 'Tool allowlist (empty = all)',
      whitelistSave: 'Save allowlist',
      whitelistHint: 'Comma separated; click Test again to apply',
      edit: 'Edit',
      save: 'Save',
      cancel: 'Cancel',
      count: '{n} configured',
      expand: 'Expand',
      collapse: 'Collapse',
    }

    const S = {
      page: { display: 'flex', flexDirection: 'column', gap: 10, padding: '2px 0' },
      header: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
      title: { fontSize: 15, fontWeight: 600, margin: 0 },
      count: { fontSize: 12, opacity: 0.6 },
      spacer: { flex: '1 1 auto' },
      intro: { fontSize: 13, opacity: 0.75, margin: 0, lineHeight: 1.5 },
      panel: {
        border: '1px solid var(--dsh-border, rgba(127,127,127,0.35))',
        borderRadius: 8,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 0,
      },
      row: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 },
      grow: { flex: '1 1 160px', minWidth: 0 },
      name: { fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      url: {
        fontSize: 11,
        opacity: 0.6,
        wordBreak: 'break-all',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      badge: {
        fontSize: 10,
        padding: '1px 6px',
        borderRadius: 999,
        border: '1px solid var(--dsh-border, rgba(127,127,127,0.45))',
        opacity: 0.85,
        whiteSpace: 'nowrap',
      },
      status: { fontSize: 11, opacity: 0.7, whiteSpace: 'nowrap' },
      dot: (color) => ({
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: color,
        display: 'inline-block',
        flex: '0 0 auto',
      }),
      input: {
        fontSize: 13,
        padding: '6px 8px',
        borderRadius: 6,
        border: '1px solid var(--dsh-border, rgba(127,127,127,0.45))',
        background: 'transparent',
        color: 'inherit',
        minWidth: 0,
      },
      button: {
        fontSize: 12,
        padding: '5px 12px',
        borderRadius: 6,
        border: '1px solid var(--dsh-border, rgba(127,127,127,0.45))',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      },
      small: { fontSize: 11, padding: '3px 9px' },
      primary: { borderColor: 'var(--dsh-accent, #3b82f6)' },
      chevron: {
        border: 'none',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        fontSize: 12,
        opacity: 0.7,
        padding: '0 2px',
        flex: '0 0 auto',
      },
      hint: { fontSize: 11, opacity: 0.6, margin: 0 },
      error: { fontSize: 12, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', opacity: 0.95 },
      mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
      stack: { display: 'flex', flexDirection: 'column', gap: 6 },
    }

    const NAME_RE = /^[A-Za-z0-9_-]{1,32}$/

    /**
     * Map a failed attempt's raw text onto the causes the design names (wrong
     * path, missing header, wrong transport), plus an unreachable host. The raw
     * text is always shown as well; these never replace it.
     */
    function diagnose(state, t) {
      const raw = [
        String(state?.error ?? ''),
        ...(state?.attempts ?? []).map((attempt) => String(attempt?.error ?? '')),
      ].join(' \n ')
      const rules = [
        [/\b40[13]\b|unauthorized|forbidden/i, 'hintHeader'],
        [/\b40[45]\b|not found/i, 'hintUrl'],
        [/\b406\b|event-stream/i, 'hintTransport'],
        [/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timed out|fetch failed/i, 'hintRefused'],
      ]
      const hints = []
      for (const [pattern, key] of rules) {
        if (pattern.test(raw) && !hints.includes(t(key))) hints.push(t(key))
        if (hints.length === 3) break
      }
      return hints.length > 0 ? hints : [t('hintNone')]
    }

    function slug(text) {
      const base = String(text).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
      return base === '' ? `server-${Date.now().toString(36)}` : base.slice(0, 32)
    }

    function transportSelect(value, onChange) {
      return h('select', { style: S.input, value, onChange }, [
        h('option', { key: 'auto', value: 'auto' }, 'auto'),
        h('option', { key: 'http', value: 'http' }, 'streamable-http'),
        h('option', { key: 'sse', value: 'sse' }, 'sse'),
      ])
    }

    function McpSettingsSection(props) {
      const t = props.t
      const [loading, setLoading] = React.useState(true)
      const [error, setError] = React.useState(null)
      const [servers, setServers] = React.useState([])
      const [revision, setRevision] = React.useState(undefined)
      const [saving, setSaving] = React.useState(false)
      const [adding, setAdding] = React.useState(false)
      const [form, setForm] = React.useState({ name: '', url: '', transport: 'auto' })
      const [formError, setFormError] = React.useState(null)
      const [tested, setTested] = React.useState({})
      const [busy, setBusy] = React.useState({})
      const [callArgs, setCallArgs] = React.useState({})
      const [callResult, setCallResult] = React.useState({})
      const [allowDraft, setAllowDraft] = React.useState({})
      const [editing, setEditing] = React.useState({})
      const [editError, setEditError] = React.useState(null)
      const [expanded, setExpanded] = React.useState({})

      // Resolve the settings remote lazily: the client service table may still
      // be filling in while this section registers.
      const remoteApi = () => (typeof props.remote === 'function' ? props.remote() : props.remote)

      /**
       * Seed the rows from the host's live connection state. Without this a
       * freshly opened panel reports every server as "not connected" until the
       * user clicks Test, even though the host is already connected.
       */
      const syncFromHost = async () => {
        try {
          const response = await fetch(`${API}/servers`)
          if (!response.ok) return
          const body = await response.json()
          if (!body?.ok) return
          const next = {}
          for (const row of body.servers ?? []) {
            if (row.status === 'ready') {
              next[row.id] = {
                ok: true,
                transport: row.connectedTransport,
                connectedTransport: row.connectedTransport,
                latencyMs: row.latencyMs,
                tools: row.tools ?? [],
                serverInfo: row.serverInfo,
                attempts: [],
              }
            } else if (row.status === 'error') {
              next[row.id] = {
                ok: false,
                error: row.lastError,
                attempts: [],
                tools: [],
              }
            }
          }
          setTested(next)
        } catch {
          // the panel still works from its own test results
        }
      }

      const refresh = React.useCallback(async () => {
        setLoading(true)
        try {
          const remote = remoteApi()
          if (remote === undefined) {
            setError(`${t('loadFailed')}settings remote unavailable`)
            return
          }
          const response = await remote.describe()
          if (!response?.ok) {
            setError(`${t('loadFailed')}${response?.error?.message ?? 'unknown'}`)
            return
          }
          const view = (response.value?.namespaces ?? []).find((entry) => entry.ns === SETTINGS_NS)
          if (view === undefined) {
            setServers([])
            setRevision(undefined)
            setError(`${t('loadFailed')}namespace ${SETTINGS_NS} not found`)
            return
          }
          setError(null)
          setServers(Array.isArray(view.value?.servers) ? view.value.servers : [])
          setRevision(view.revision)
          // The host owns the live connection state; this page's own test
          // results are only a cache of it. Seed the rows from the host so a
          // freshly opened panel does not report every server as "not connected".
          await syncFromHost()
        } catch (cause) {
          setError(`${t('loadFailed')}${String(cause && cause.message ? cause.message : cause)}`)
        } finally {
          setLoading(false)
        }
      }, [t])

      React.useEffect(() => {
        void refresh()
      }, [refresh])

      const writeServers = async (next) => {
        setSaving(true)
        try {
          const remote = remoteApi()
          if (remote === undefined) {
            setFormError(`${t('saveFailed')}settings remote unavailable`)
            return false
          }
          const response = await remote.mutate(SETTINGS_NS, [{ op: 'set', path: ['servers'], value: next }], revision)
          if (!response?.ok) {
            setFormError(`${t('saveFailed')}${response?.error?.message ?? 'unknown'}`)
            return false
          }
          setServers(next)
          const nextRevision = response.value?.revision ?? response.value?.ns?.revision
          if (typeof nextRevision === 'number') setRevision(nextRevision)
          await refresh()
          return true
        } finally {
          setSaving(false)
        }
      }

      const addServer = async () => {
        const name = form.name.trim()
        const url = form.url.trim()
        if (!NAME_RE.test(name)) {
          setFormError(t('nameInvalid'))
          return
        }
        if (!/^https?:\/\//i.test(url)) {
          setFormError(t('urlInvalid'))
          return
        }
        if (servers.some((server) => server.name === name)) {
          setFormError(`${t('nameInvalid')} (${name})`)
          return
        }
        const entry = {
          id: `${slug(name)}-${Date.now().toString(36).slice(-4)}`,
          name,
          enabled: true,
          transport: form.transport,
          url,
          headers: {},
          timeoutMs: 15000,
          toolCallTimeoutMs: 60000,
          toolAllow: [],
        }
        const ok = await writeServers([...servers, entry])
        if (ok) {
          setForm({ name: '', url: '', transport: 'auto' })
          setFormError(null)
          setAdding(false)
        }
      }

      const removeServer = async (id) => {
        await writeServers(servers.filter((server) => server.id !== id))
        setTested((current) => {
          const next = { ...current }
          delete next[id]
          return next
        })
      }

      const saveAllow = async (server, raw) => {
        const list = String(raw).split(',').map((item) => item.trim()).filter(Boolean)
        await writeServers(servers.map((row) => (row.id === server.id ? { ...row, toolAllow: list } : row)))
      }

      const startEdit = (server) => {
        setEditError(null)
        setEditing((current) => ({
          ...current,
          [server.id]: { name: server.name, url: server.url, transport: server.transport },
        }))
      }

      const cancelEdit = (id) => {
        setEditError(null)
        setEditing((current) => {
          const next = { ...current }
          delete next[id]
          return next
        })
      }

      const saveEdit = async (id) => {
        const draft = editing[id]
        if (draft === undefined) return
        const name = String(draft.name).trim()
        const url = String(draft.url).trim()
        if (!NAME_RE.test(name)) {
          setEditError(t('nameInvalid'))
          return
        }
        if (!/^https?:\/\//i.test(url)) {
          setEditError(t('urlInvalid'))
          return
        }
        if (servers.some((row) => row.id !== id && row.name === name)) {
          setEditError(`${t('nameInvalid')} (${name})`)
          return
        }
        const ok = await writeServers(
          servers.map((row) => (row.id === id ? { ...row, name, url, transport: draft.transport } : row)),
        )
        if (ok) cancelEdit(id)
      }

      const toggleEnabled = async (server) => {
        await writeServers(
          servers.map((row) => (row.id === server.id ? { ...row, enabled: server.enabled === false } : row)),
        )
      }

      const toggleExpanded = (id) => {
        setExpanded((current) => ({ ...current, [id]: current[id] !== true }))
      }

      const runTest = async (id) => {
        setBusy((current) => ({ ...current, [id]: true }))
        try {
          const response = await fetch(`${API}/test`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id }),
          })
          const body = await response.json()
          setTested((current) => ({ ...current, [id]: body }))
        } catch (cause) {
          setTested((current) => ({
            ...current,
            [id]: { ok: false, error: String(cause && cause.message ? cause.message : cause) },
          }))
        } finally {
          setBusy((current) => ({ ...current, [id]: false }))
        }
      }

      const runCall = async (id, tool) => {
        const key = `${id}:${tool}`
        const raw = callArgs[key] ?? '{}'
        let parsed
        try {
          parsed = JSON.parse(raw === '' ? '{}' : raw)
        } catch (cause) {
          setCallResult((current) => ({
            ...current,
            [key]: { ok: false, error: `JSON: ${String(cause && cause.message ? cause.message : cause)}` },
          }))
          return
        }
        setBusy((current) => ({ ...current, [key]: true }))
        try {
          const response = await fetch(`${API}/call`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id, tool, arguments: parsed }),
          })
          const body = await response.json()
          setCallResult((current) => ({ ...current, [key]: body }))
        } catch (cause) {
          setCallResult((current) => ({
            ...current,
            [key]: { ok: false, error: String(cause && cause.message ? cause.message : cause) },
          }))
        } finally {
          setBusy((current) => ({ ...current, [key]: false }))
        }
      }

      const children = []

      // ── Header: title, count, and the primary action at the top ──────────
      children.push(h('div', { key: 'header', style: S.header }, [
        h('h3', { key: 't', style: S.title }, t('title')),
        h('span', { key: 'c', style: S.count }, t('count').replace('{n}', String(servers.length))),
        h('span', { key: 'sp', style: S.spacer }),
        h('button', {
          key: 'add',
          type: 'button',
          style: { ...S.button, ...S.primary },
          onClick: () => {
            setAdding((current) => !current)
            setFormError(null)
          },
        }, adding ? t('cancel') : t('addServer')),
      ]))
      children.push(h('p', { key: 'intro', style: S.intro }, t('intro')))

      // ── Add form, directly under the header ───────────────────────────────
      if (adding) {
        children.push(h('div', { key: 'add-form', style: S.panel }, [
          h('div', { key: 'r', style: S.row }, [
            h('input', {
              key: 'n',
              style: { ...S.input, flex: '0 1 140px' },
              placeholder: t('name'),
              value: form.name,
              onChange: (event) => setForm((current) => ({ ...current, name: event.target.value })),
            }),
            h('input', {
              key: 'u',
              style: { ...S.input, flex: '1 1 220px' },
              placeholder: 'http://127.0.0.1:8731/mcp',
              value: form.url,
              onChange: (event) => setForm((current) => ({ ...current, url: event.target.value })),
            }),
            transportSelect(form.transport, (event) =>
              setForm((current) => ({ ...current, transport: event.target.value })),
            ),
            h('button', {
              key: 'a',
              type: 'button',
              style: { ...S.button, ...S.primary },
              disabled: saving,
              onClick: () => void addServer(),
            }, saving ? t('saving') : t('add')),
          ]),
          h('p', { key: 'h', style: S.hint }, t('nameHint')),
          formError !== null ? h('p', { key: 'e', style: S.error }, formError) : null,
        ]))
      }

      if (error !== null) {
        children.push(h('p', { key: 'err', style: S.error }, error))
      }

      if (loading) {
        children.push(h('p', { key: 'loading', style: S.hint }, t('testing')))
      }

      if (!loading && servers.length === 0 && error === null) {
        children.push(h('div', { key: 'empty', style: S.panel }, [
          h('p', { key: 'e', style: S.error }, t('empty')),
          h('p', { key: 'h', style: S.hint }, t('emptyHint')),
        ]))
      }

      // ── Server rows: compact when collapsed, full detail when expanded ────
      for (const server of servers) {
        const state = tested[server.id]
        const draft = editing[server.id]
        const isOpen = expanded[server.id] === true
        const isBusy = busy[server.id] === true
        const isOff = server.enabled === false
        const statusColor = isOff ? '#8a8a8a' : state === undefined ? '#8a8a8a' : state.ok === true ? '#3ba55d' : '#d9534f'
        const statusText = isOff
          ? t('disabled')
          : state === undefined
            ? t('idle')
            : state.ok === true
              ? `${t('connected')} · ${state.transport ?? '?'} · ${state.latencyMs ?? '?'}ms`
              : t('failed')

        const tools = state?.tools ?? []
        const hints = state !== undefined && state.ok !== true ? diagnose(state, t) : []
        const allowValue = allowDraft[server.id] ?? (server.toolAllow ?? []).join(', ')

        const main = h('div', { key: 'main', style: S.row }, [
          h('button', {
            key: 'ch',
            type: 'button',
            style: S.chevron,
            title: isOpen ? t('collapse') : t('expand'),
            'aria-expanded': isOpen,
            onClick: () => toggleExpanded(server.id),
          }, isOpen ? '▾' : '▸'),
          h('span', { key: 'dot', style: S.dot(statusColor) }),
          h('div', { key: 'id', style: S.grow }, [
            h('div', { key: 'n', style: S.name }, server.name),
            h('div', { key: 'u', style: S.url }, server.url),
          ]),
          h('span', { key: 'tr', style: S.badge }, server.transport),
          state?.ok === true && state.connectedTransport !== undefined
            ? h('span', { key: 'ct', style: S.badge }, `→ ${state.connectedTransport}`)
            : null,
          h('span', { key: 'st', style: S.status }, statusText),
        ])

        const body = []
        if (draft !== undefined) {
          body.push(h('div', { key: 'edit', style: S.row }, [
            h('input', {
              key: 'n',
              style: { ...S.input, flex: '0 1 140px' },
              placeholder: t('name'),
              value: draft.name,
              onChange: (event) => setEditing((current) => ({
                ...current,
                [server.id]: { ...current[server.id], name: event.target.value },
              })),
            }),
            h('input', {
              key: 'u',
              style: { ...S.input, flex: '1 1 220px' },
              placeholder: t('url'),
              value: draft.url,
              onChange: (event) => setEditing((current) => ({
                ...current,
                [server.id]: { ...current[server.id], url: event.target.value },
              })),
            }),
            transportSelect(draft.transport, (event) => setEditing((current) => ({
              ...current,
              [server.id]: { ...current[server.id], transport: event.target.value },
            }))),
            h('button', {
              key: 's',
              type: 'button',
              style: { ...S.button, ...S.primary, ...S.small },
              disabled: saving,
              onClick: () => void saveEdit(server.id),
            }, saving ? t('saving') : t('save')),
            h('button', {
              key: 'c',
              type: 'button',
              style: { ...S.button, ...S.small },
              onClick: () => cancelEdit(server.id),
            }, t('cancel')),
          ]))
          if (editError !== null) body.push(h('p', { key: 'ee', style: S.error }, editError))
        }

        body.push(h('div', { key: 'actions', style: S.row }, [
          h('button', {
            key: 'test',
            type: 'button',
            style: { ...S.button, ...S.small, ...S.primary },
            disabled: isBusy || isOff,
            onClick: () => void runTest(server.id),
          }, isBusy ? t('testing') : t('test')),
          h('button', {
            key: 'edit',
            type: 'button',
            style: { ...S.button, ...S.small },
            disabled: saving,
            onClick: () => (draft === undefined ? startEdit(server) : cancelEdit(server.id)),
          }, draft === undefined ? t('edit') : t('cancel')),
          h('button', {
            key: 'toggle',
            type: 'button',
            style: { ...S.button, ...S.small },
            disabled: saving,
            onClick: () => void toggleEnabled(server),
          }, isOff ? t('enable') : t('disable')),
          h('button', {
            key: 'rm',
            type: 'button',
            style: { ...S.button, ...S.small },
            disabled: saving,
            onClick: () => void removeServer(server.id),
          }, t('remove')),
        ]))

        if (hints.length > 0) {
          body.push(h('div', { key: 'hints', style: S.stack }, [
            h('p', { key: 'hl', style: S.hint }, t('hints')),
            ...hints.map((hint, index) => h('p', { key: `hint-${index}`, style: S.hint }, `· ${hint}`)),
          ]))
        }

        if (state !== undefined && state.ok !== true) {
          body.push(h('p', { key: 'raw', style: S.error }, `${t('rawError')}:\n${state.error ?? ''}\n${(state.attempts ?? []).map((a) => `${a.transport}: ${a.error}`).join('\n')}`))
        }

        body.push(h('div', { key: 'allow', style: S.row }, [
          h('input', {
            key: 'i',
            style: { ...S.input, ...S.mono, flex: '1 1 200px' },
            placeholder: t('whitelist'),
            value: allowValue,
            onChange: (event) => setAllowDraft((current) => ({ ...current, [server.id]: event.target.value })),
          }),
          h('button', {
            key: 'b',
            type: 'button',
            style: { ...S.button, ...S.small },
            disabled: saving,
            onClick: () => void saveAllow(server, allowValue),
          }, t('whitelistSave')),
          h('span', { key: 'h', style: S.hint }, t('whitelistHint')),
        ]))

        if (state?.ok === true && tools.length === 0) {
          body.push(h('p', { key: 'notools', style: S.hint }, t('noTools')))
        }

        if (state?.ok === true && tools.length > 0) {
          body.push(h('div', { key: 'tools', style: S.stack }, [
            h('p', { key: 'tl', style: S.hint }, `${t('tools')}: ${tools.map((tool) => tool.name).join(', ')}`),
            ...tools.map((tool) => {
              const key = `${server.id}:${tool.name}`
              return h('div', { key, style: S.panel }, [
                h('div', { key: 'r', style: S.row }, [
                  h('code', { key: 'c', style: { ...S.mono, flex: '1 1 auto' } }, tool.name),
                  h('span', { key: 'req', style: S.hint }, (tool.required ?? []).join(', ')),
                ]),
                h('textarea', {
                  key: 'a',
                  style: { ...S.input, ...S.mono, minHeight: 40 },
                  placeholder: t('args'),
                  value: callArgs[key] ?? '{}',
                  onChange: (event) => setCallArgs((current) => ({ ...current, [key]: event.target.value })),
                }),
                h('div', { key: 'actions', style: S.row }, [
                  h('button', {
                    key: 'call',
                    type: 'button',
                    style: { ...S.button, ...S.small, ...S.primary },
                    disabled: busy[key] === true,
                    onClick: () => void runCall(server.id, tool.name),
                  }, t('call')),
                  callResult[key] !== undefined
                    ? h('code', { key: 'out', style: S.mono },
                        callResult[key].ok === true
                          ? String(callResult[key].text ?? '')
                          : `${t('rawError')}: ${callResult[key].error ?? ''}`)
                    : null,
                ]),
              ])
            }),
          ]))
        }

        children.push(h('div', { key: server.id, style: S.panel }, [
          main,
          isOpen ? h('div', { key: 'body', style: S.stack }, body) : null,
        ]))
      }

      return h('div', { style: S.page, 'data-mcp-settings-section': true }, children)
    }

    return {
      // Test seam: the module loader ignores extra keys, and the standalone
      // test suite can exercise the failure-to-cause mapping and render the
      // section with a minimal hook runtime, without a DOM.
      __test: { diagnose, Section: McpSettingsSection },
      // The browser context proxy throws for any service that was not declared
      // here ("cannot get property … without inject"), so `remote` and
      // `remote.settings` are named explicitly.
      inject: ['locale', 'slots', 'remote', 'remote.settings'],
      apply(ctx) {
        ctx.effect(
          () => ctx.locale.register(NS, { zh, en }),
          'mcp-hub: dictionaries',
        )
        const t = ctx.locale.bind(NS)
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'mcp',
              order: 25,
              label: () => t('nav'),
              locale: NS,
              inject: () => ({ remote: () => ctx.remote?.settings }),
            },
            McpSettingsSection,
          ),
        )
      },
    }
  },
})
