// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import CommandPalette from './CommandPalette.vue'
import CommandItem from './CommandItem.vue'
import { createPaletteContext, type PaletteTestOptions } from '../testing'
import type { Command } from '../types'

function cmd(id: string, label: string, extra: Partial<Command> = {}): Command {
  return { id, label, perform: () => {}, ...extra }
}

function mountPalette(ctxOptions: PaletteTestOptions = {}, props: Record<string, unknown> = {}) {
  const helpers = createPaletteContext(ctxOptions)
  const wrapper = mount(CommandPalette, {
    props,
    global: { provide: helpers.provide, stubs: { teleport: true, transition: true } },
  })
  return { wrapper, ...helpers }
}

async function open(ctx: ReturnType<typeof createPaletteContext>['ctx']) {
  ctx.isOpen.value = true
  await nextTick()
}

describe('CommandPalette', () => {
  beforeEach(() => vi.stubGlobal('localStorage', undefined))
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('renders the dialog only when open', async () => {
    const { wrapper, ctx } = mountPalette({ commands: [cmd('a', 'Alpha')] })
    expect(wrapper.find('.vcp-dialog').exists()).toBe(false)
    await open(ctx)
    expect(wrapper.find('.vcp-dialog').exists()).toBe(true)
  })

  it('filters results by query', async () => {
    const { wrapper, ctx } = mountPalette({ commands: [cmd('a', 'Alpha'), cmd('b', 'Beta')] })
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('beta')
    const items = wrapper.findAll('.vcp-item')
    expect(items).toHaveLength(1)
    expect(items[0].text()).toContain('Beta')
  })

  it('ArrowDown / ArrowUp move the active item', async () => {
    const { wrapper, ctx } = mountPalette({ commands: [cmd('a', 'Alpha'), cmd('b', 'Beta'), cmd('c', 'Gamma')] })
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('a') // matches all (fuzzy)
    const dialog = wrapper.find('.vcp-dialog')
    expect(ctx.activeIndex.value).toBe(0)
    await dialog.trigger('keydown', { key: 'ArrowDown' })
    expect(ctx.activeIndex.value).toBe(1)
    await dialog.trigger('keydown', { key: 'ArrowUp' })
    expect(ctx.activeIndex.value).toBe(0)
  })

  it('Enter executes the active command and closes', async () => {
    const perform = vi.fn()
    const { wrapper, ctx } = mountPalette({ commands: [cmd('a', 'Alpha', { perform })] })
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('alpha')
    await wrapper.find('.vcp-dialog').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(perform).toHaveBeenCalledOnce()
    expect(ctx.isOpen.value).toBe(false)
  })

  it('clicking an item executes it', async () => {
    const perform = vi.fn()
    const { wrapper, ctx } = mountPalette({ commands: [cmd('a', 'Alpha', { perform })] })
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('alpha')
    await wrapper.find('.vcp-item').trigger('click')
    await flushPromises()
    expect(perform).toHaveBeenCalledOnce()
  })

  it('shows a confirm dialog and runs the command on confirm', async () => {
    const perform = vi.fn()
    const { wrapper, ctx } = mountPalette({
      commands: [cmd('del', 'Delete', { perform, confirm: 'Sure?' })],
    })
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('delete')
    await wrapper.find('.vcp-item').trigger('click')
    expect(wrapper.find('.vcp-confirm').exists()).toBe(true)
    expect(perform).not.toHaveBeenCalled()
    await wrapper.find('.vcp-confirm__btn--yes').trigger('click')
    await flushPromises()
    expect(perform).toHaveBeenCalledOnce()
  })

  it('cancel dismisses the confirm dialog without running', async () => {
    const perform = vi.fn()
    const { wrapper, ctx } = mountPalette({
      commands: [cmd('del', 'Delete', { perform, confirm: 'Sure?' })],
    })
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('delete')
    await wrapper.find('.vcp-item').trigger('click')
    await wrapper.find('.vcp-confirm__btn--no').trigger('click')
    expect(wrapper.find('.vcp-confirm').exists()).toBe(false)
    expect(perform).not.toHaveBeenCalled()
  })

  it('navigates into deeply nested sub-commands and back', async () => {
    const leaf = cmd('leaf', 'Leaf Item')
    const mid = cmd('mid', 'Mid Level', { subCommands: [leaf] })
    const top = cmd('top', 'Top Level', { subCommands: [mid] })
    const { wrapper, ctx } = mountPalette({ commands: [top] })
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('top level')
    await wrapper.find('.vcp-item').trigger('click') // → into Top
    await nextTick()
    expect(ctx.history.value.map(h => h.paletteId)).toEqual(['top'])
    expect(wrapper.text()).toContain('Mid Level')

    await wrapper.find('.vcp-item').trigger('click') // → into Mid (2nd level)
    await nextTick()
    expect(ctx.history.value.map(h => h.paletteId)).toEqual(['top', 'mid'])
    // before the fix this was empty (resolution via getAllCommands missed nested ids)
    expect(wrapper.text()).toContain('Leaf Item')

    // Backspace returns to the parent level
    await wrapper.find('.vcp-dialog').trigger('keydown', { key: 'Backspace' })
    await nextTick()
    expect(ctx.history.value.map(h => h.paletteId)).toEqual(['top'])
    expect(wrapper.text()).toContain('Mid Level')
  })

  it('opens a nested sub-palette and shows a breadcrumb', async () => {
    const child = cmd('child', 'Child')
    const parent = cmd('parent', 'Parent', { subCommands: [child] })
    const { wrapper, ctx } = mountPalette({ commands: [parent] })
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('parent')
    await wrapper.find('.vcp-item').trigger('click')
    await nextTick()
    expect(ctx.history.value).toHaveLength(1)
    expect(wrapper.find('.vcp-breadcrumb').exists()).toBe(true)
    expect(wrapper.text()).toContain('Child')
  })

  it('merges async group results into the list', async () => {
    vi.useFakeTimers()
    const { wrapper, ctx } = mountPalette({
      groups: [{
        id: 'remote', label: 'Remote', commands: [],
        onSearch: async (q) => [cmd(`r-${q}`, `Result ${q}`)],
      }],
    })
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('x')
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()
    vi.useRealTimers()
    expect(wrapper.text()).toContain('Result x')
  })

  it('shows an input spinner while async loads, without blanking existing results', async () => {
    vi.useFakeTimers()
    let resolveSearch: (cmds: Command[]) => void = () => {}
    const { wrapper, ctx } = mountPalette({
      commands: [cmd('alpha', 'Alpha')], // sync match shown immediately
      groups: [{
        id: 'remote', label: 'Remote', commands: [],
        onSearch: () => new Promise<Command[]>((res) => { resolveSearch = res }),
      }],
    })
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('alpha')

    // After the debounce fires, async is in-flight: spinner shows, results stay
    await vi.advanceTimersByTimeAsync(250)
    expect(wrapper.find('.vcp-input-spinner').exists()).toBe(true)
    expect(wrapper.text()).toContain('Alpha')

    // Resolve the async search — spinner clears
    resolveSearch([cmd('r-1', 'Remote result')])
    await flushPromises()
    vi.useRealTimers()
    expect(wrapper.find('.vcp-input-spinner').exists()).toBe(false)
    expect(wrapper.text()).toContain('Alpha')
  })

  it('respects the labels prop (recent header)', async () => {
    const { wrapper, ctx } = mountPalette(
      { commands: [cmd('a', 'Alpha')] },
      { labels: { recent: 'Недавние' } },
    )
    ctx.recentIds.value = ['a']
    await open(ctx)
    expect(wrapper.text()).toContain('Недавние')
  })

  it('opens a page command with its own placeholder and async search', async () => {
    vi.useFakeTimers()
    const pageCmd = cmd('search-users', 'Search Users', {
      page: {
        placeholder: 'Type a name…',
        onSearch: async (q) => [cmd(`u-${q}`, `User ${q}`)],
      },
    })
    const { wrapper, ctx } = mountPalette({ commands: [pageCmd] })
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('search users')
    await wrapper.find('.vcp-item').trigger('click')
    await nextTick()
    expect(wrapper.find('input.vcp-input').attributes('placeholder')).toBe('Type a name…')
    await wrapper.find('input.vcp-input').setValue('bob')
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()
    vi.useRealTimers()
    expect(wrapper.text()).toContain('User bob')
  })

  it('renders a command badge', async () => {
    const { wrapper, ctx } = mountPalette({ commands: [cmd('a', 'Alpha', { badge: 'New' })] })
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('alpha')
    const badge = wrapper.find('.vcp-item__badge')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('New')
  })

  it('announces the result count via aria-live', async () => {
    const { wrapper, ctx } = mountPalette({ commands: [cmd('a', 'Alpha'), cmd('b', 'Alfa')] })
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('al')
    expect(wrapper.find('.vcp-sr-only').text()).toContain('2 results')
  })

  it('calls onHighlight when the active command changes', async () => {
    const onHighlight = vi.fn()
    const { wrapper, ctx } = mountPalette({ commands: [cmd('a', 'Alpha'), cmd('b', 'Alfa')], onHighlight })
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('al')
    expect(onHighlight).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }))
    await wrapper.find('.vcp-dialog').trigger('keydown', { key: 'ArrowDown' })
    expect(onHighlight).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'b' }))
  })

  it('shows a match hint when a keyword matched but the label did not', async () => {
    const { wrapper, ctx } = mountPalette({ commands: [cmd('a', 'Settings', { keywords: ['config'] })] })
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('config')
    const hint = wrapper.find('.vcp-item__match-hint')
    expect(hint.exists()).toBe(true)
    expect(hint.text()).toContain('config')
  })

  it('highlights the query inside the description when it matched there', async () => {
    const { wrapper, ctx } = mountPalette({
      commands: [cmd('a', 'Assign to user…', { description: 'Opens a page with async search' })],
    })
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('op') // matches "Op" in the description, not the label
    const mark = wrapper.find('.vcp-item__description mark.vcp-match')
    expect(mark.exists()).toBe(true)
    expect(mark.text().toLowerCase()).toBe('op')
  })

  it('shows the match hint even when the command has a description (alias/keyword match)', async () => {
    const { wrapper, ctx } = mountPalette({
      commands: [cmd('a', 'Go to Settings', { description: 'Account preferences', aliases: ['Options'] })],
    })
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('op') // matches alias "Options", not the label
    const item = wrapper.find('.vcp-item')
    expect(item.find('.vcp-item__match-hint').text()).toContain('Options')
    expect(item.find('.vcp-item__description').exists()).toBe(true) // description still shown
  })

  it('merges plugin-level onSearch results', async () => {
    vi.useFakeTimers()
    const { wrapper, ctx } = mountPalette({
      commands: [cmd('alpha', 'Alpha')],
      onSearch: async (q) => [cmd(`g-${q}`, `Global ${q}`)],
    })
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('alpha')
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()
    vi.useRealTimers()
    expect(wrapper.text()).toContain('Global alpha')
  })

  it('activates a prefix mode and searches via its onSearch', async () => {
    vi.useFakeTimers()
    const { wrapper, ctx } = mountPalette(
      { commands: [cmd('a', 'Alpha')] },
      { modes: [{ prefix: '>', label: 'Run', placeholder: 'Run a command…', onSearch: (q: string) => [cmd(`r-${q}`, `Result ${q}`)] }] },
    )
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('>build')
    expect(wrapper.find('.vcp-mode-chip').text()).toBe('Run')
    expect(wrapper.find('input.vcp-input').attributes('placeholder')).toBe('Run a command…')
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()
    vi.useRealTimers()
    expect(wrapper.text()).toContain('Result build')
    // regular command should not appear while a mode is active
    expect(wrapper.text()).not.toContain('Alpha')
    // async (mode) results are highlighted too
    expect(wrapper.find('.vcp-item mark.vcp-match').exists()).toBe(true)
  })

  it('reserves a chevron column on every row, with the glyph only for groups', async () => {
    const { wrapper, ctx } = mountPalette({
      groups: [{
        id: 'g', label: 'G',
        commands: [cmd('a', 'Alpha'), cmd('grp', 'Group', { subCommands: [cmd('x', 'X')] })],
      }],
    })
    await open(ctx)
    const items = wrapper.findAll('.vcp-item')
    expect(items).toHaveLength(2)
    // every row reserves the chevron column…
    for (const it of items) expect(it.find('.vcp-item__chevron').exists()).toBe(true)
    // …but the glyph is only on the group
    const group = items.find(i => i.text().includes('Group'))!
    const plain = items.find(i => i.text().includes('Alpha'))!
    expect(group.find('.vcp-item__chevron').text()).toBe('›')
    expect(plain.find('.vcp-item__chevron').text()).toBe('')
  })

  it('renders a Pinned section for pinned commands', async () => {
    const { wrapper, ctx } = mountPalette({ commands: [cmd('a', 'Alpha')] })
    ctx.pinnedIds.value = ['a']
    await open(ctx)
    expect(wrapper.text()).toContain('Pinned')
    expect(wrapper.find('[id="vcp-item-pinned-a"]').exists()).toBe(true)
  })

  it('clicking the pin toggles pinned state without executing the command', async () => {
    const perform = vi.fn()
    const { wrapper, ctx } = mountPalette({ commands: [cmd('a', 'Alpha', { perform })] })
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('alpha')
    const pin = wrapper.find('.vcp-item .vcp-item__pin')
    expect(pin.exists()).toBe(true) // column reserved on every row
    expect(pin.classes()).not.toContain('vcp-item__pin--on')

    await pin.trigger('click')
    expect(ctx.pinnedIds.value).toContain('a')
    expect(perform).not.toHaveBeenCalled() // pin click must not run the command
    expect(wrapper.find('.vcp-item .vcp-item__pin').classes()).toContain('vcp-item__pin--on')

    await wrapper.find('.vcp-item .vcp-item__pin').trigger('click')
    expect(ctx.pinnedIds.value).not.toContain('a')
  })

  it('$mod+P toggles pin on the active command', async () => {
    const { wrapper, ctx } = mountPalette({ commands: [cmd('a', 'Alpha')] })
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('alpha')
    await wrapper.find('.vcp-dialog').trigger('keydown', { key: 'p', metaKey: true })
    expect(ctx.pinnedIds.value).toContain('a')
  })

  it('opens the actions menu with Tab and runs an action with Enter', async () => {
    const perform = vi.fn()
    const c = cmd('a', 'Alpha', { actions: [{ id: 'x', label: 'Do X', perform }] })
    const { wrapper, ctx } = mountPalette({ commands: [c] })
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('alpha')
    await wrapper.find('.vcp-dialog').trigger('keydown', { key: 'Tab' })
    expect(wrapper.find('.vcp-actions').exists()).toBe(true)
    expect(wrapper.text()).toContain('Do X')
    await wrapper.find('.vcp-dialog').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(perform).toHaveBeenCalledOnce()
    expect(ctx.isOpen.value).toBe(false)
  })

  it('closes the actions menu with Backspace / back button (without closing the palette)', async () => {
    const c = cmd('a', 'Alpha', { actions: [{ id: 'x', label: 'Do X', perform: () => {} }] })
    const { wrapper, ctx } = mountPalette({ commands: [c] })
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('alpha')
    await wrapper.find('.vcp-dialog').trigger('keydown', { key: 'Tab' })
    expect(wrapper.find('.vcp-actions').exists()).toBe(true)

    // Backspace returns to the list, palette stays open
    await wrapper.find('.vcp-dialog').trigger('keydown', { key: 'Backspace' })
    expect(wrapper.find('.vcp-actions').exists()).toBe(false)
    expect(wrapper.find('input.vcp-input').exists()).toBe(true)
    expect(ctx.isOpen.value).toBe(true)

    // reopen and close via the back button
    await wrapper.find('.vcp-dialog').trigger('keydown', { key: 'Tab' })
    await wrapper.find('.vcp-actions__back').trigger('click')
    expect(wrapper.find('.vcp-actions').exists()).toBe(false)
    expect(ctx.isOpen.value).toBe(true)
  })

  it('keeps focus inside the dialog in actions mode (so keys still reach the handler)', async () => {
    // The input is removed in actions mode; without moving focus, key events would
    // hit <body> and never reach the dialog's keydown handler.
    const helpers = createPaletteContext({ commands: [cmd('a', 'Alpha', { actions: [{ id: 'x', label: 'X', perform: () => {} }] })] })
    const wrapper = mount(CommandPalette, {
      attachTo: document.body,
      global: { provide: helpers.provide, stubs: { teleport: true, transition: true } },
    })
    helpers.ctx.isOpen.value = true
    await nextTick()
    await wrapper.find('input.vcp-input').setValue('alpha')
    await wrapper.find('.vcp-dialog').trigger('keydown', { key: 'Tab' })
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.find('.vcp-dialog').element)
    wrapper.unmount()
  })

  it('multi-select: Enter toggles, $mod+Enter submits the selection', async () => {
    const { wrapper, ctx } = mountPalette({ commands: [cmd('a', 'Alpha'), cmd('b', 'Alfa')] }, { selectable: true })
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('al')
    await wrapper.find('.vcp-dialog').trigger('keydown', { key: 'Enter' }) // toggle active (Alpha)
    expect(wrapper.find('.vcp-item--selected').exists()).toBe(true)
    await wrapper.find('.vcp-dialog').trigger('keydown', { key: 'Enter', metaKey: true }) // submit
    const events = wrapper.emitted('submit-selection')
    expect(events).toBeTruthy()
    expect((events![0][0] as Array<{ id: string }>).map(c => c.id)).toEqual(['a'])
    expect(ctx.isOpen.value).toBe(false)
  })

  it('recalls previous queries with Alt+ArrowUp', async () => {
    const { wrapper, ctx } = mountPalette({ commands: [cmd('a', 'Alpha')] })
    ctx.queryHistory.value = ['previous search']
    await open(ctx)
    await wrapper.find('.vcp-dialog').trigger('keydown', { key: 'ArrowUp', altKey: true })
    expect(ctx.query.value).toBe('previous search')
  })

  it('orders groups by best match and keeps the active item in sync', async () => {
    // b1 is an exact label match; a1 only a prefix. Group B has lower static priority,
    // but its better match should float it to the top — and the active item follows.
    const { wrapper, ctx } = mountPalette({
      groups: [
        { id: 'ga', label: 'A', priority: 100, commands: [cmd('a1', 'Network')] },
        { id: 'gb', label: 'B', priority: 10, commands: [cmd('b1', 'ne')] },
      ],
    })
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('ne')
    // the exact match ranks first, even though its group has lower priority
    expect(wrapper.findAll('.vcp-item')[0].attributes('id')).toBe('vcp-item-b1')
    expect(wrapper.find('input.vcp-input').attributes('aria-activedescendant')).toBe('vcp-item-b1')
  })

  it('ranks name matches above description/keyword matches', async () => {
    const { wrapper, ctx } = mountPalette({
      groups: [{
        id: 'g', label: 'G',
        commands: [
          cmd('bykw', 'Team', { keywords: ['people'] }),       // matches "ope" only via keyword
          cmd('byname', 'Open File'),                           // matches "ope" in the name
        ],
      }],
    })
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('ope')
    const ids = wrapper.findAll('.vcp-item').map(i => i.attributes('id'))
    // name match first, keyword match after
    expect(ids).toEqual(['vcp-item-byname', 'vcp-item-bykw'])
  })

  it('hides disabled commands by default, shows them greyed with showDisabled', async () => {
    const perform = vi.fn()
    // default: disabled command is filtered out of search
    const a = mountPalette({ commands: [cmd('a', 'Alpha', { disabled: true, perform })] })
    await open(a.ctx)
    await a.wrapper.find('input.vcp-input').setValue('alpha')
    expect(a.wrapper.find('.vcp-item').exists()).toBe(false)

    // showDisabled: rendered, greyed, with reason, not executable
    const b = mountPalette({
      commands: [cmd('a', 'Alpha', { disabled: true, disabledReason: 'Offline only', perform })],
      showDisabled: true,
    })
    await open(b.ctx)
    await b.wrapper.find('input.vcp-input').setValue('alpha')
    const item = b.wrapper.find('.vcp-item')
    expect(item.exists()).toBe(true)
    expect(item.classes()).toContain('vcp-item--disabled')
    expect(item.attributes('title')).toBe('Offline only')
    await item.trigger('click')
    expect(perform).not.toHaveBeenCalled()
  })

  it('renders a preview pane for the active command', async () => {
    const helpers = createPaletteContext({ commands: [cmd('a', 'Alpha')] })
    const wrapper = mount(CommandPalette, {
      props: { preview: true },
      slots: { preview: (p: { command: Command | null }) => h('div', { class: 'pv' }, `PV:${p.command?.label ?? ''}`) },
      global: { provide: helpers.provide, stubs: { teleport: true, transition: true } },
    })
    helpers.ctx.isOpen.value = true
    await nextTick()
    await wrapper.find('input.vcp-input').setValue('alpha')
    expect(wrapper.find('.vcp-preview').exists()).toBe(true)
    expect(wrapper.find('.pv').text()).toBe('PV:Alpha')
  })

  it('renders command.info (HTML) in the preview pane', async () => {
    const { wrapper, ctx } = mountPalette(
      { commands: [cmd('a', 'Alpha', { info: '<b class="vcp-test-info">Details here</b>' })] },
      { preview: true },
    )
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('alpha')
    const info = wrapper.find('.vcp-preview__info')
    expect(info.exists()).toBe(true)
    expect(info.find('.vcp-test-info').exists()).toBe(true)
    expect(info.text()).toContain('Details here')
  })

  it('toggles the preview pane via the toggle button and hotkey', async () => {
    const { wrapper, ctx } = mountPalette({ commands: [cmd('a', 'Alpha', { info: 'x' })] }, { preview: true })
    await open(ctx)
    // pane stays mounted; collapse is driven by a class (so width can animate)
    expect(wrapper.find('.vcp-preview').classes()).not.toContain('vcp-preview--collapsed')
    // click the toggle button → collapses
    await wrapper.find('.vcp-preview-toggle').trigger('click')
    expect(wrapper.find('.vcp-preview').classes()).toContain('vcp-preview--collapsed')
    // $mod+I → re-opens
    await wrapper.find('.vcp-dialog').trigger('keydown', { key: 'i', metaKey: true })
    expect(wrapper.find('.vcp-preview').classes()).not.toContain('vcp-preview--collapsed')
  })

  it('swipes right to navigate back from a nested palette', async () => {
    const parent = cmd('p', 'Parent', { subCommands: [cmd('c', 'Child')] })
    const { wrapper, ctx } = mountPalette({ commands: [parent] })
    await open(ctx)
    await wrapper.find('input.vcp-input').setValue('parent')
    await wrapper.find('.vcp-item').trigger('click')
    await nextTick()
    expect(ctx.history.value).toHaveLength(1)
    const dialog = wrapper.find('.vcp-dialog')
    await dialog.trigger('touchstart', { changedTouches: [{ clientX: 10, clientY: 20 }] })
    await dialog.trigger('touchend', { changedTouches: [{ clientX: 120, clientY: 25 }] })
    expect(ctx.history.value).toHaveLength(0)
  })
})

describe('CommandItem', () => {
  it('shows the disabled reason as a title tooltip', () => {
    const wrapper = mount(CommandItem, {
      props: {
        command: cmd('a', 'Alpha', { disabled: true, disabledReason: 'Not available offline' }),
        active: false,
        matches: [],
        itemId: 'vcp-item-a',
      },
    })
    expect(wrapper.find('.vcp-item').attributes('title')).toBe('Not available offline')
  })
})
